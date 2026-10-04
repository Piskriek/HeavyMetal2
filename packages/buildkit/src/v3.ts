/**
 * The hotbar, exactly as the owner's spec V3 lays it out (docs/HOTBAR_V3_SPEC.md), with the V3.1 changes listed at the end of that file:
 * three modes (Game, Simplified, Advanced), twelve tabs (F1..F12) with the spec's names per mode, and per mode its own layout. Game Mode's
 * tabs hold numbered presets; Simplified Mode's tabs hold sub-tools, each with its sliders and presets; Advanced Mode's tabs hold tools,
 * filters and modifiers (F3 also presets). The names are the spec's, word for word. Not a mix with the old hotbar (owner, 2026-10-04): what
 * the island already does is the engine behind these buttons (`bind`: the internal tab and way that does it, and the palette picks it sets
 * first); a button whose engine is not built yet says so (`todo`). Pure data.
 */
import type { TabId } from './tabs';

export type V3Mode = 'game' | 'simplified' | 'advanced';
/** The internal level each mode runs on (the gizmo, the free cursor and the rest key off it). */
export type V3Level = 'easy' | 'pro' | 'studio';
export const V3_MODES: readonly { readonly id: V3Mode; readonly level: V3Level; readonly name: string; readonly doc: string }[] = [
  { id: 'game', level: 'easy', name: 'Game', doc: 'Game Mode: your goblin holds the tool and every use pops, squishes and bounces. Numbered presets, nothing to set.' },
  { id: 'simplified', level: 'pro', name: 'Simplified', doc: 'Simplified Mode: the gizmo on whatever you pick, and plain sliders and presets for each tool.' },
  { id: 'advanced', level: 'studio', name: 'Advanced', doc: 'Advanced Mode: the gizmo, every tool, its filters and its keys.' },
];
export const modeOfLevel = (level: string): V3Mode => (level === 'pro' ? 'simplified' : level === 'studio' ? 'advanced' : 'game');
export const levelOfMode = (mode: V3Mode): V3Level => V3_MODES.find((x) => x.id === mode)?.level ?? 'easy';
/** The mode after this one (the backtick key). */
export const nextMode = (mode: V3Mode): V3Mode => V3_MODES[(V3_MODES.findIndex((x) => x.id === mode) + 1) % V3_MODES.length]!.id;

/** The palette keys a button can set before it acts (what the internal ways read). */
export type V3PaletteKey = 'paint' | 'sculpt' | 'things' | 'lights' | 'logic' | 'effects' | 'sound' | 'characters' | 'physics' | 'lamp' | 'wire' | 'tint' | 'zone' | 'walk' | 'box' | 'road';
/** What a button does inside the island: the internal tab and way that does it, and the palette picks it sets first. */
export interface V3Bind { readonly tab: TabId; readonly way: string; readonly palette?: Readonly<Partial<Record<V3PaletteKey, string>>>; readonly todo?: true }
/** A list a tool picks from (Advanced's options row, Game's Prop Box): which list, and the palette key the pick goes to. */
export type V3Source = 'blocks' | 'props' | 'plants' | 'sounds' | 'effects' | 'paints' | 'tints' | 'brains' | 'wires';
export interface V3Options { readonly label: string; readonly palette: V3PaletteKey; readonly source: V3Source }
export interface V3Button {
  readonly id: string; readonly name: string; readonly doc: string; readonly icon: string; readonly bind: V3Bind;
  /** What the left and the right button do, when the internal way's own words do not fit. */
  readonly left?: string; readonly right?: string;
  readonly options?: V3Options;
}
/** What a slider changes (the island has a handler for each; a slider without one shows as coming). */
export type V3Drive =
  | 'tool-size' | 'tool-width' | 'tool-strength' | 'tint-colour' | 'hour' | 'clouds' | 'zone-size' | 'effect-size' | 'lamp-brightness'
  | 'loudness' | 'hearing' | 'amb-volume' | 'walk-speed' | 'walk-wait' | 'density' | 'block-size' | 'prop-size' | 'random-turn' | 'orbit-time';
export interface V3Slider {
  readonly id: string; readonly name: string;
  readonly kind: 'range' | 'toggle' | 'choice' | 'color';
  readonly min?: number; readonly max?: number; readonly step?: number; readonly unit?: string; readonly value?: number;
  readonly choices?: readonly string[];
  readonly drives?: V3Drive;
}
export interface V3SubTool { readonly id: string; readonly name: string; readonly icon: string; readonly sliders: readonly V3Slider[]; readonly presets: readonly V3Button[] }
export interface V3Filter { readonly name: string; readonly todo?: true }
export interface V3Modifier { readonly keys: string; readonly does: string; readonly todo?: true }
export interface V3Tab {
  readonly key: string;
  readonly game: { readonly name: string; readonly icon: string; readonly look: string; readonly presets: readonly V3Button[] };
  readonly simplified: { readonly name: string; readonly title: string; readonly icon: string; readonly subtools: readonly V3SubTool[] };
  readonly advanced: { readonly name: string; readonly icon: string; readonly tools: readonly V3Button[]; readonly presets?: readonly V3Button[]; readonly filters: readonly V3Filter[]; readonly modifiers: readonly V3Modifier[] };
}

type Pal = Partial<Record<V3PaletteKey, string>>;
type More = Partial<Pick<V3Button, 'left' | 'right' | 'options'>>;
const b = (tab: TabId, way: string, palette?: Pal): V3Bind => (palette ? { tab, way, palette } : { tab, way });
const todo = (tab: TabId, way: string): V3Bind => ({ tab, way, todo: true });
const btn = (id: string, name: string, doc: string, icon: string, bind: V3Bind, more: More = {}): V3Button => ({ id, name, doc, icon, bind, ...more });
/** A Simplified preset or an Advanced tool: its name is its doc unless one is given. */
const p = (id: string, name: string, icon: string, bind: V3Bind, doc = '', more: More = {}): V3Button => btn(id, name, doc || name, icon, bind, more);
const range = (id: string, name: string, min: number, max: number, unit: string, value: number, step = 1, drives?: V3Drive): V3Slider => ({ id, name, kind: 'range', min, max, unit, value, step, ...(drives ? { drives } : {}) });
const toggle = (id: string, name: string, drives?: V3Drive): V3Slider => ({ id, name, kind: 'toggle', value: 0, ...(drives ? { drives } : {}) });
const choice = (id: string, name: string, choices: string[]): V3Slider => ({ id, name, kind: 'choice', choices, value: 0 });
const colour = (id: string, name: string, drives?: V3Drive): V3Slider => ({ id, name, kind: 'color', ...(drives ? { drives } : {}) });
const sub = (id: string, name: string, icon: string, sliders: V3Slider[], presets: V3Button[]): V3SubTool => ({ id, name, icon, sliders, presets });
const f = (name: string, works = false): V3Filter => (works ? { name } : { name, todo: true });
const m = (keys: string, does: string, works = false): V3Modifier => (works ? { keys, does } : { keys, does, todo: true });

export const V3_TABS: readonly V3Tab[] = [
  {
    key: 'F1',
    game: { name: 'Grab Tool', icon: 'Magnet', look: 'Magic Magnet / Hand', presets: [
      btn('grab-single', 'Grab Single Toy', 'Picks whatever the crosshair hits; click again to put it down.', 'Hand', b('select', 'move')),
      btn('vacuum-bubble', 'Vacuum Bubble', 'Draws all small clutter into a levitating cluster.', 'Wind', todo('select', 'v3-vacuum')),
      btn('freeze-wand', 'Freeze Wand', 'Flash freeze sound; ice crystals encase the item in mid-air.', 'Snowflake', todo('select', 'v3-freeze')),
      btn('toss-pitch', 'Toss / Pitch', 'Wind up your arm and launch the item forward with a wind trail.', 'ArrowUpFromLine', todo('physics', 'v3-toss')),
      btn('clone-popper', 'Clone Popper', "Plays 'POP!': the item splits into two with a confetti burst.", 'Copy', b('select', 'copy')),
      btn('trash-zap', 'Trash Zap', 'The item shrinks into a cartoon black hole and disappears with a squeak.', 'Trash2', b('select', 'delete')),
    ] },
    simplified: { name: 'Select', title: 'Pick & Box Select', icon: 'MousePointer2', subtools: [
      sub('click-picker', 'Click Picker', 'MousePointer2', [range('reach', 'Reach Distance', 1, 100, 'm', 30), range('outline', 'Outline Thickness', 1, 5, 'px', 2)], [
        p('pick-anything', 'Pick Anything', 'MousePointer2', b('select', 'inspect')),
        p('only-props', 'Only Props', 'Package', b('select', 'inspect')),
        p('only-characters', 'Only Characters', 'Users', todo('select', 'v3-pick-characters')),
        p('only-lights', 'Only Lights', 'Lightbulb', todo('select', 'v3-pick-lights')),
      ]),
      sub('box-drag', 'Box Drag', 'SquareDashedMousePointer', [toggle('depth-limit', 'Depth Limit')], [
        p('enclosed-only', 'Enclosed Only', 'SquareDashedMousePointer', b('select', 'select-box', { box: 'enclosed' })),
        p('touch-any-part', 'Touch Any Part', 'SquareDashedMousePointer', b('select', 'select-box', { box: 'touch' })),
      ]),
      sub('group-linker', 'Group Linker', 'Link', [], [
        p('link-single', 'Link as Single Object', 'Link', todo('select', 'v3-link')),
        p('unlink', 'Unlink Object', 'Unlink', todo('select', 'v3-unlink')),
        p('lock-in-place', 'Lock in Place', 'KeyRound', todo('select', 'v3-lock')),
        p('save-as-toy', 'Save as Toy', 'Package', todo('select', 'v3-save-toy'), 'V3.1: the linked group becomes one of your toys in the Prop Box, under My Toys.'),
      ]),
    ] },
    advanced: { name: 'Selection', icon: 'MousePointer2', tools: [
      p('raycast-pointer', 'Raycast Pointer', 'MousePointer2', b('select', 'inspect')),
      p('marquee-box', 'Marquee Box', 'SquareDashedMousePointer', b('select', 'select-box', { box: 'touch' })),
      p('lasso', 'Lasso', 'Lasso', todo('select', 'v3-lasso')),
      p('surface-paint-select', 'Surface Paint', 'Paintbrush', todo('select', 'v3-paint-select')),
      p('hierarchy', 'Hierarchy', 'Layers', b('select', 'v3-hierarchy'), 'Every thing on the island in a list (the Layers window).', { left: 'Open the list', right: 'Open the list' }),
      p('similar', 'Similar', 'Shapes', todo('select', 'v3-similar')),
    ], filters: [f('Static Mesh', true), f('Lights'), f('Skeletal Mesh'), f('Triggers'), f('Splines'), f('Decals')],
    modifiers: [m('Ctrl+Click', 'Append', true), m('Alt+Click', 'Invert'), m('Shift+DblClick', 'Connected')] },
  },
  {
    key: 'F2',
    game: { name: 'Color Spray', icon: 'SprayCan', look: 'Spray Can & Stickers', presets: [
      btn('rainbow-spray', 'Rainbow Spray', 'Splashes bright saturated paint on the part of the thing you click: a new colour every time.', 'Palette', b('paint', 'paint-thing', { tint: 'rainbow' }), { left: 'Spray it', right: 'Spray it' }),
      btn('glitter-gloss', 'Glitter Gloss', 'Surfaces gleam with high-specular glint stars.', 'Sparkles', todo('paint', 'v3-gloss')),
      btn('glow-paint', 'Glow Paint', 'Emits pulsing neon rings visible through walls.', 'Lightbulb', todo('paint', 'v3-glow')),
      btn('sticker-emotes', 'Sticker Stamp: Emotes', 'Slaps animated smiling and winking face decals on walls.', 'Smile', todo('paint', 'v3-sticker')),
      btn('sticker-splats', 'Sticker Stamp: Splats', 'Splatters messy cartoon slime drips.', 'Droplet', todo('paint', 'v3-splat')),
      btn('water-sponge', 'Water Sponge', 'A giant wet sponge wipes the paint off the thing you click: back to the colours it was made with.', 'Eraser', b('paint', 'paint-thing', { tint: 'sponge' }), { left: 'Wipe it', right: 'Wipe it' }),
    ] },
    simplified: { name: 'Paint', title: 'Color & Material Painter', icon: 'Paintbrush', subtools: [
      sub('surface-color-paint', 'Surface Color Paint', 'Paintbrush', [range('brush', 'Brush Size', 0.1, 10, 'm', 1, 0.1), colour('color', 'Color Picker', 'tint-colour'), range('opacity', 'Opacity', 0, 100, '%', 100)], [
        p('matte-paint', 'Matte Paint', 'Paintbrush', b('paint', 'paint-thing'), 'Paint the part of the thing you click in the picked colour.'),
        p('glossy-car', 'Glossy Car Finish', 'Sparkles', todo('paint', 'v3-gloss')),
        p('glowing-neon', 'Glowing Neon', 'Lightbulb', todo('paint', 'v3-glow')),
        p('metallic-chrome', 'Metallic Chrome', 'Shield', todo('paint', 'v3-chrome')),
      ]),
      sub('decal-sticker', 'Decal Sticker', 'Stamp', [range('size', 'Size', 0.1, 5, 'm', 1, 0.1), range('rotation', 'Rotation', 0, 360, '°', 0), range('fade', 'Fade Edges', 0, 100, '%', 20)], [
        p('dirt-grime', 'Dirt & Grime', 'Wind', todo('paint', 'v3-decal')),
        p('cracks-holes', 'Cracks & Holes', 'Scissors', todo('paint', 'v3-decal')),
        p('posters', 'Posters', 'Image', todo('paint', 'v3-decal')),
        p('road-markings', 'Road Markings', 'Route', todo('paint', 'v3-decal')),
      ]),
      sub('color-eraser', 'Color Eraser', 'Eraser', [range('radius', 'Eraser Radius', 0.1, 10, 'm', 1, 0.1), range('softness', 'Softness', 0, 100, '%', 50)], [
        p('erase-layer', 'Erase Layer', 'Eraser', b('paint', 'paint-thing', { tint: 'sponge' }), 'Wipe the paint off the thing you click.'),
        p('revert-default', 'Revert to Default Material', 'RotateCcw', b('paint', 'paint-thing', { tint: 'sponge' }), 'The thing you click goes back to the colours it was made with.'),
      ]),
      // V3.1: the ground's own materials
      sub('ground-material', 'Ground Material', 'Layers', [range('brush', 'Brush Size', 0.5, 12, 'm', 3, 0.5, 'tool-size'), range('softness', 'Softness', 5, 100, '%', 50, 5, 'tool-strength')], [
        p('grass', 'Grass', 'Sprout', b('paint', 'paint-brush', { paint: '4' })),
        p('sand', 'Sand', 'Waves', b('paint', 'paint-brush', { paint: '2' })),
        p('rock', 'Rock', 'Mountain', b('paint', 'paint-brush', { paint: '5' })),
        p('moss', 'Moss', 'Sprout', b('paint', 'paint-brush', { paint: '11' })),
        p('mud', 'Mud', 'Droplet', b('paint', 'paint-brush', { paint: '9' })),
        p('lava', 'Lava', 'Flame', b('paint', 'paint-brush', { paint: '13' })),
        p('cobbles', 'Cobbles', 'Grid3x3', b('paint', 'paint-brush', { paint: '24' })),
        p('dirt-road', 'Dirt Road', 'Route', b('paint', 'paint-brush', { paint: '22' })),
      ]),
    ] },
    advanced: { name: 'Brushes', icon: 'Brush', tools: [
      p('pbr-surface-paint', 'PBR Surface Paint', 'Paintbrush', b('paint', 'paint-brush'), 'Paint the ground with any of its materials.', { options: { label: 'Material', palette: 'paint', source: 'paints' } }),
      p('vertex-color', 'Vertex Color', 'Palette', b('paint', 'paint-thing'), 'Colour every block of one colour of the thing you click.', { options: { label: 'Colour', palette: 'tint', source: 'tints' } }),
      p('triplanar-projection', 'Triplanar Projection', 'Grid3x3', todo('paint', 'v3-triplanar')),
      p('clone-stamp', 'Clone Stamp', 'Stamp', b('paint', 'paint-clone')),
    ], filters: [f('Albedo RGB'), f('Roughness'), f('Metalness'), f('Tangent Normal'), f('Ambient Occlusion')],
    modifiers: [m('[ / ]', 'Radius Adjust', true), m('Shift+Drag', 'Laplacian Smooth'), m('Alt', 'Eyedropper')] },
  },
  {
    key: 'F3',
    game: { name: 'Blocks and Clay', icon: 'Box', look: 'Toy Builder & Play-Doh', presets: [
      btn('toy-brick', 'Toy Brick', 'Drops a stackable plastic block.', 'Box', b('things', 'things-one', { things: 'block-cube' })),
      btn('smooth-ball', 'Smooth Ball', 'Spawns a sphere.', 'Circle', b('things', 'things-one', { things: 'block-ball' })),
      btn('ramp-slide', 'Ramp / Slide', 'Drops a wedge ramp.', 'Triangle', b('things', 'things-one', { things: 'block-wedge' })),
      btn('clay-plump', 'Clay Plump', 'Squirts a blob of clay that adds volume to the ground or a thing.', 'CirclePlus', b('things', 'v3-clay-plump'), { left: 'Add clay', right: 'Scoop it out' }),
      btn('clay-scoop', 'Clay Scoop', 'Scoops a round bite out of the ground or a thing.', 'CircleMinus', b('things', 'v3-clay-scoop'), { left: 'Scoop it out', right: 'Add clay' }),
      btn('clay-flatten', 'Clay Flatten', 'Whacks the ground with an oversized iron to press it flat.', 'Minus', b('sculpt', 'flatten')),
      btn('punch-hole', 'Punch Hole', 'Cookie-cutter rings punch a clean round doorway through a wall.', 'CircleDot', todo('things', 'v3-punch')),
      // V3.1: the island's own things
      btn('prop-box', 'Prop Box', 'Pick a prop from the box that pops up while you hold this, then click to drop it with a POOF.', 'PackageOpen', b('things', 'things-one', { things: 'barrel' }), { options: { label: 'Prop', palette: 'things', source: 'props' } }),
    ] },
    simplified: { name: 'Shapes and Sculpt', title: 'Basic Shapes & Clay Sculpt', icon: 'Box', subtools: [
      sub('add-block', 'Add Building Block', 'Box', [range('width', 'Width', 0.1, 50, 'm', 1, 0.1, 'block-size'), range('height', 'Height', 0.1, 50, 'm', 1, 0.1), choice('snap', 'Snap to Grid', ['0.25 m', '0.5 m', '1 m'])], [
        p('cube', 'Cube', 'Box', b('things', 'things-one', { things: 'block-cube' })),
        p('ball', 'Ball', 'Circle', b('things', 'things-one', { things: 'block-ball' })),
        p('cylinder', 'Cylinder', 'Cylinder', b('things', 'things-one', { things: 'block-cylinder' })),
        p('wedge', 'Wedge', 'Triangle', b('things', 'things-one', { things: 'block-wedge' })),
        p('staircase', 'Staircase', 'ChartNoAxesColumnIncreasing', b('things', 'things-one', { things: 'block-stairs' })),
        p('hollow-box', 'Hollow Box', 'Square', b('things', 'things-one', { things: 'block-hollow-box' })),
      ]),
      sub('clay-modeling', 'Clay Modeling', 'Layers', [range('brush', 'Brush Size', 0.1, 5, 'm', 1, 0.1, 'tool-size'), range('strength', 'Push/Pull Strength', 1, 100, '%', 50, 1, 'tool-strength'), range('softness', 'Surface Softness', 1, 100, '%', 50)], [
        p('add-clay', 'Add Clay', 'CirclePlus', b('things', 'v3-clay-plump'), 'Add clay to the ground or the thing you point at.', { left: 'Add clay', right: 'Dig it out' }),
        p('dig-out', 'Dig Out', 'CircleMinus', b('things', 'v3-clay-scoop'), 'Dig into the ground or the thing you point at.', { left: 'Dig it out', right: 'Add clay' }),
        p('smooth-surface', 'Smooth Surface', 'Waves', b('sculpt', 'smooth')),
        p('flatten-flat', 'Flatten Flat', 'Minus', b('sculpt', 'flatten')),
      ]),
      sub('cut-carve', 'Cut & Carve (Booleans)', 'Scissors', [range('bevel', 'Hole Border Bevel', 0, 10, 'cm', 0)], [
        p('cut-hole-out', 'Cut Hole Out', 'CircleDot', b('things', 'things-carve')),
        p('join-shapes', 'Join Shapes Together', 'Combine', todo('things', 'v3-join')),
        p('cut-in-half', 'Cut in Half', 'Scissors', todo('things', 'v3-cut-half')),
      ]),
      // V3.1: the island's own things
      sub('place-props', 'Place Props', 'PackageOpen', [range('size', 'Size', 50, 200, '%', 100, 5, 'prop-size'), toggle('random-turn', 'Random Turn', 'random-turn')], [
        p('palm', 'Palm', 'TreePalm', b('things', 'things-one', { things: 'palm' })),
        p('bush', 'Bush', 'Sprout', b('things', 'things-one', { things: 'bush' })),
        p('rock', 'Rock', 'Gem', b('things', 'things-one', { things: 'rock' })),
        p('flowers', 'Flowers', 'Flower2', b('things', 'things-one', { things: 'flowers' })),
        p('barrel', 'Barrel', 'Package', b('things', 'things-one', { things: 'barrel' })),
        p('trophy', 'Trophy', 'Trophy', b('things', 'things-one', { things: 'trophy' })),
        p('plinth', 'Plinth', 'Square', b('things', 'things-one', { things: 'statue-plinth' })),
        p('goblin-statue', 'Goblin Statue', 'Smile', b('things', 'things-one', { things: 'goblin' })),
        p('ball-racer', 'Ball Racer', 'Circle', b('things', 'things-one', { things: 'goblin-ball-racer' })),
      ]),
    ] },
    advanced: { name: 'Geometry', icon: 'Shapes', tools: [
      p('primitive-generator', 'Primitive Generator', 'Box', b('things', 'things-one', { things: 'block-cube' }), 'A building block where you point.', { options: { label: 'Shape', palette: 'things', source: 'blocks' } }),
      p('zbrush-clay', 'ZBrush Clay Sculpt', 'Layers', b('sculpt', 'sculpt-clay')),
      p('dynmesh', 'DynMesh', 'Network', todo('things', 'v3-dynmesh')),
      p('csg-booleans', 'CSG Booleans', 'Combine', b('things', 'things-carve')),
      p('retopo', 'Retopo', 'Grid3x3', todo('things', 'v3-retopo')),
      p('prop-placer', 'Prop Placer', 'PackageOpen', b('things', 'things-one', { things: 'palm' }), 'V3.1: any of the island\'s props where you point.', { options: { label: 'Prop', palette: 'things', source: 'props' } }),
    ], presets: [
      p('clay-buildup', 'Clay Buildup (Dynamic Volumetric Sculpting)', 'Layers', b('sculpt', 'sculpt-clay')),
      p('dyntopo', 'DynMesh / Dyntopo (Procedural Tessellation On Stroke)', 'Network', todo('things', 'v3-dynmesh')),
      p('heightmap-sculpt', 'Texture Heightmap Sculpt (16-bit Float Displacement)', 'Mountain', b('sculpt', 'raise')),
      p('micro-groove', 'Tangent Normal Micro-Groove Sculpt (Vector Displace)', 'Scissors', b('sculpt', 'sculpt-crease')),
      p('trim-polish', 'Hard-Surface Trim Planar Polish & Crease', 'Gem', b('sculpt', 'sculpt-pinch')),
      p('csg', 'CSG Union / Difference / Intersect Booleans', 'Combine', b('things', 'things-carve')),
      p('quad-remesh', 'Quad-Remesh & Edge-Loop Slicer', 'Grid3x3', todo('things', 'v3-retopo')),
    ], filters: [],
    modifiers: [m('Ctrl+Drag', 'Invert Sculpt'), m('Shift+Drag', 'Relax'), m('M', 'Toggle Texture/Geo')] },
  },
  {
    key: 'F4',
    game: { name: 'Puppet Show', icon: 'Drama', look: 'Dance & Moves', presets: [
      btn('live-puppet', 'Live Puppet', "Drag a character's limbs in real time; it follows the cursor.", 'Hand', todo('animate', 'v3-puppet')),
      btn('silly-dance', 'Silly Dance', 'Your goblin does a goofy shuffle dance.', 'Music', b('animate', 'dance'), { left: 'Dance', right: 'Dance' }),
      btn('walk-to-me', 'Walk to Me', 'The goblin you point at comes over and stays near you.', 'Footprints', b('characters', 'chars-change', { characters: 'follow' })),
      btn('follow-leader', 'Follow The Leader', 'The goblin you point at follows you wherever you go.', 'Users', b('characters', 'chars-change', { characters: 'follow' })),
      btn('freeze-statue', 'Freeze Statue', 'The goblin you point at stands still like a statue.', 'Trophy', b('characters', 'chars-change', { characters: 'stand' })),
    ] },
    simplified: { name: 'Animate', title: 'Character Moves & Sequences', icon: 'Activity', subtools: [
      sub('pose-adjuster', 'Pose Adjuster', 'PersonStanding', [range('limb-turn', 'Limb Turn', -180, 180, '°', 0), toggle('mirror', 'Mirror Other Side')], [
        p('standing-rest', 'Standing Rest', 'PersonStanding', todo('animate', 'v3-pose')),
        p('action-ready', 'Action Ready', 'Zap', todo('animate', 'v3-pose')),
        p('sitting-down', 'Sitting Down', 'Armchair', todo('animate', 'v3-pose')),
        p('fallen-down', 'Fallen Down', 'Minus', todo('animate', 'v3-pose')),
      ]),
      sub('walk-path', 'Walk Path Creator', 'Route', [range('speed', 'Move Speed', 1, 20, 'km/h', 5, 1, 'walk-speed'), range('wait', 'Wait at Stop', 0, 60, 's', 1, 1, 'walk-wait')], [
        p('back-forth', 'Back & Forth Loop', 'Repeat', b('animate', 'anim-path', { walk: 'ping-pong' })),
        p('circle-track', 'Circle Track', 'RotateCcw', b('animate', 'anim-path', { walk: 'loop' })),
        p('one-way', 'One-Way Trip', 'ArrowRight', b('animate', 'anim-path', { walk: 'once' })),
      ]),
      sub('quick-animator', 'Quick Animator', 'Activity', [range('play-speed', 'Play Speed', 0.25, 2, 'x', 1, 0.05), toggle('loop', 'Loop')], [
        p('idle-breathe', 'Idle Breathe', 'PersonStanding', b('animate', 'idle')),
        p('walk', 'Walk', 'Footprints', b('animate', 'walk')),
        p('run', 'Run', 'Wind', b('animate', 'run')),
        p('jump', 'Jump', 'ArrowUpFromLine', b('animate', 'jump')),
        p('cheer', 'Cheer', 'PartyPopper', b('animate', 'cheer')),
        p('defeat', 'Defeat', 'ArrowDownToLine', todo('animate', 'v3-defeat')),
      ]),
    ] },
    advanced: { name: 'Animation', icon: 'Film', tools: [
      p('auto-key', 'Auto-Key Transform', 'KeyRound', todo('animate', 'v3-autokey')),
      p('spline-path', 'Spline Path', 'Route', b('animate', 'anim-path', { walk: 'ping-pong' })),
      p('dope-sheet', 'Dope Sheet', 'Film', todo('animate', 'v3-dopesheet')),
      p('onion-skinning', 'Onion Skinning', 'Layers', todo('animate', 'v3-onion')),
      p('root-lock', 'Root Lock', 'Anchor', todo('animate', 'v3-rootlock')),
    ], filters: [f('Key Hierarchy'), f('Key Selected Bones'), f('Mirrored Pose'), f('Tangent Bezier/Step')],
    modifiers: [m('I', 'Keyframe Punch'), m('J/K/L', 'Video Shuttle Scrub'), m('Alt+R', 'Reset Rotation')] },
  },
  {
    key: 'F5',
    game: { name: 'Boombox', icon: 'Radio', look: 'Noise Maker', presets: [
      btn('funny-sounds', 'Funny Sounds', 'Boing, splash, toot: a different funny sound every click, with floating notes.', 'Music', b('sound', 'v3-funny'), { left: 'Play one', right: 'Play one' }),
      btn('monster-roar', 'Monster Roar', 'A big roar; a red shockwave rings out from where you point.', 'Flame', b('sound', 'v3-roar'), { left: 'Roar', right: 'Roar' }),
      btn('jukebox-track', 'Jukebox Track', 'A floating turntable plays a looping groove.', 'Disc3', todo('sound', 'v3-jukebox')),
      btn('echo-dome', 'Echo Dome', 'A shimmering soap bubble; talking inside gives cathedral reverb.', 'CircleDot', todo('sound', 'v3-echo')),
      btn('step-doorbell', 'Step Doorbell', 'A floor bell that rings a chime when a goblin steps on it.', 'Bell', b('logic', 'v3-doorbell'), { left: 'Put a bell here', right: 'Take away the nearest bell' }),
    ] },
    simplified: { name: 'Audio', title: 'Sound & Ambience', icon: 'Volume2', subtools: [
      sub('place-sound', 'Place Sound Effect', 'Volume2', [range('loudness', 'Loudness', 0, 100, '%', 80, 1, 'loudness'), range('hearing', 'Hearing Distance', 1, 50, 'm', 10, 1, 'hearing'), range('pitch', 'Pitch', 50, 150, '%', 100)], [
        p('footstep-click', 'Footstep Click', 'Footprints', b('sound', 'sound-place', { sound: 'ui-click' })),
        p('machine-hum', 'Machine Hum', 'Cog', b('sound', 'sound-place', { sound: 'boost' })),
        p('water-drop', 'Water Drop', 'Droplet', b('sound', 'sound-place', { sound: 'splash' })),
        p('explosion-boom', 'Explosion Boom', 'Flame', b('sound', 'sound-place', { sound: 'shockwave' })),
      ]),
      sub('ambience-zone', 'Background Ambience Zone', 'Waves', [range('volume', 'Volume', 0, 100, '%', 80, 1, 'amb-volume'), range('fade', 'Fade In/Out Area', 1, 10, 'm', 6)], [
        p('forest-birds', 'Forest Birds', 'Bird', b('sound', 'sound-place', { sound: 'forest-birds' })),
        p('windy-hill', 'Windy Hill', 'Wind', b('sound', 'sound-place', { sound: 'windy-hill' })),
        p('creepy-cave', 'Creepy Cave', 'Mountain', b('sound', 'sound-place', { sound: 'creepy-cave' })),
        p('busy-city', 'Busy City', 'Building', b('sound', 'sound-place', { sound: 'busy-city' })),
        p('rainy-day', 'Rainy Day', 'CloudRain', b('sound', 'sound-place', { sound: 'rainy-day' })),
      ]),
    ] },
    advanced: { name: 'Sound', icon: 'AudioLines', tools: [
      p('point-emitter', '3D Point Emitter', 'Volume2', b('sound', 'sound-place', { sound: 'item-pickup' }), 'A sound that plays again and again from where you point.', { options: { label: 'Sound', palette: 'sound', source: 'sounds' } }),
      p('reverb-volume', 'Reverb Volume', 'Waves', todo('sound', 'v3-reverb')),
      p('directional-cone', 'Directional Cone', 'Radio', todo('sound', 'v3-cone')),
      p('occlusion-mask', 'Occlusion Mask', 'VolumeX', todo('sound', 'v3-occlusion')),
    ], filters: [f('Logarithmic Falloff'), f('Doppler Link'), f('HF Wall Dampening'), f('Audio Busses')],
    modifiers: [m('Alt+Scale', 'Falloff Radii'), m('P', 'Audition Spatial Audio At Cursor')] },
  },
  {
    key: 'F6',
    game: { name: 'Lantern', icon: 'Lamp', look: 'Flashlight & Sun Clock', presets: [
      btn('sticky-flashlight', 'Sticky Flashlight', 'Sticks a hovering glowing light orb to whatever surface you click.', 'Flashlight', b('lights', 'light-lamp', { lamp: 'flashlight-orb' })),
      btn('campfire-glow', 'Campfire Glow', 'A crackling fire glow with warm, flickering light.', 'Flame', b('lights', 'light-lamp', { lamp: 'campfire' })),
      btn('party-strobe', 'Party Strobe', 'A multicolour disco light that sweeps round (it never flashes fast).', 'Sparkles', b('lights', 'light-lamp', { lamp: 'disco' })),
      btn('turn-to-noon', 'Turn to Noon', 'The sun leaps across the sky to midday.', 'Sun', b('lights', 'v3-noon'), { left: 'Make it noon', right: 'Make it noon' }),
      btn('turn-to-night', 'Turn to Night', 'The sun drops below the horizon and the night comes.', 'Moon', b('lights', 'v3-night'), { left: 'Make it night', right: 'Make it night' }),
    ] },
    simplified: { name: 'Lights', title: 'Lighting & Sun', icon: 'Sun', subtools: [
      sub('add-light-bulb', 'Add Light Bulb', 'Lightbulb', [range('brightness', 'Brightness', 0, 100, '%', 50, 1, 'lamp-brightness'), range('glow-range', 'Glow Range', 1, 30, 'm', 10), colour('light-color', 'Light Color')], [
        p('soft-desk-lamp', 'Soft Desk Lamp', 'Lamp', b('lights', 'light-lamp', { lamp: 'lantern' })),
        p('tight-flashlight', 'Tight Flashlight', 'Flashlight', b('lights', 'light-lamp', { lamp: 'flashlight-orb' })),
        p('overhead-ceiling', 'Overhead Ceiling', 'Lightbulb', b('lights', 'light-lamp', { lamp: 'spotlight' })),
        p('color-mood', 'Color Mood', 'Palette', b('lights', 'light-lamp', { lamp: 'neon' })),
      ]),
      sub('sky-time', 'Sky & Time of Day', 'Sun', [range('time', 'Time Slider', 0, 24, 'h', 12, 0.25, 'hour'), range('sun', 'Sun Strength', 0, 100, '%', 100), range('cloudiness', 'Cloudiness', 0, 100, '%', 30, 1, 'clouds')], [
        p('bright-noon', 'Bright Noon', 'Sun', b('lights', 'light-look', { lights: 'noon-clear' })),
        p('golden-sunset', 'Golden Sunset', 'Sunset', b('lights', 'light-look', { lights: 'golden-hour' })),
        p('starry-night', 'Clear Starry Night', 'Moon', b('lights', 'light-look', { lights: 'moonlit-night' })),
        p('stormy-dark', 'Stormy Dark', 'CloudLightning', b('lights', 'light-look', { lights: 'storm-front' })),
      ]),
    ] },
    advanced: { name: 'Lights', icon: 'Sun', tools: [
      p('point-light', 'Point Light', 'Lightbulb', b('lights', 'light-lamp', { lamp: 'bulb' })),
      p('spot-light', 'Spot Light', 'Flashlight', b('lights', 'light-lamp', { lamp: 'spotlight' })),
      p('directional-sun', 'Directional Sun', 'Sun', b('lights', 'light-sun')),
      p('rect-softbox', 'Rect Softbox', 'Square', todo('lights', 'v3-softbox')),
      p('reflection-probe', 'Reflection Probe', 'Aperture', todo('lights', 'v3-probe')),
    ], filters: [f('Color Temp Kelvin'), f('Stationary/Movable/Static'), f('Volumetric Fog Multiplier')],
    modifiers: [m('Ctrl+L+Drag', 'Aim Directional Sun'), m('Alt+C', 'Pilot Light as Viewport Camera')] },
  },
  {
    key: 'F7',
    game: { name: 'Magic Cord', icon: 'Zap', look: 'Zap Wire', presets: [
      btn('step-pad-door', 'Step-Pad to Door', 'Click the floor for the step-pad, then the thing it opens: stepping on the pad opens and shuts it.', 'DoorOpen', b('logic', 'v3-cord', { wire: 'toggle' }), { left: 'Pad, then the door', right: 'Snip the cords of what you point at' }),
      btn('lever-light', 'Lever to Light', 'Click the floor for the switch, then a lamp: stepping on the switch lights it.', 'Lightbulb', b('logic', 'v3-cord', { wire: 'light-on' }), { left: 'Switch, then the lamp', right: 'Snip the cords of what you point at' }),
      btn('tripwire-alarm', 'Tripwire Alarm', 'A red laser beam; breaking it sets off a siren and a flashing beacon.', 'Siren', todo('logic', 'v3-alarm')),
      btn('launch-pad', 'Bouncy Launch Pad', 'A cord from a button to a jump pad; stepping on it launches you up.', 'ArrowUpFromLine', todo('logic', 'v3-launchpad')),
      btn('wire-cutter', 'Wire Cutter', 'Snip a cord: point at the pad or the thing it joins and click.', 'Scissors', b('logic', 'v3-cutter'), { left: 'Snip its cords', right: 'Snip its cords' }),
    ] },
    simplified: { name: 'Rules', title: 'Simple Logic & Switches', icon: 'Zap', subtools: [
      sub('trigger-zones', 'Trigger Zones', 'Scan', [range('zone-size', 'Zone Size', 1, 20, 'm', 4, 1, 'zone-size'), range('trigger-delay', 'Trigger Delay', 0, 10, 's', 0, 0.1)], [
        p('player-enters', 'Player Enters Area', 'LogIn', b('logic', 'logic-zone', { zone: 'enter' })),
        p('player-leaves', 'Player Leaves Area', 'LogOut', b('logic', 'logic-zone', { zone: 'leave' })),
        p('player-presses-e', "Player Presses 'E'", 'KeyRound', todo('logic', 'v3-press')),
      ]),
      sub('action-links', 'Action Links', 'Cable', [choice('repeat', 'Repeat Limit', ['Infinite', 'Once']), range('delay', 'Delay Before Action', 0, 30, 's', 0, 0.1)], [
        p('open-door', 'Open Door', 'DoorOpen', b('logic', 'logic-wire', { wire: 'toggle' })),
        p('turn-on-light', 'Turn On Light', 'Lightbulb', b('logic', 'logic-wire', { wire: 'light-on' })),
        p('play-sound', 'Play Sound', 'Bell', b('logic', 'logic-wire', { wire: 'sound' })),
        p('damage-player', 'Damage Player', 'HeartCrack', todo('logic', 'v3-damage')),
        p('teleport', 'Teleport', 'Orbit', b('logic', 'logic-wire', { wire: 'teleport' })),
      ]),
    ] },
    advanced: { name: 'Logic', icon: 'GitBranch', tools: [
      p('trigger-volume', 'Trigger Volume', 'Scan', b('logic', 'logic-zone', { zone: 'enter' })),
      p('visual-wire-graph', 'Visual Wire Graph', 'Workflow', b('logic', 'logic-graph'), 'Every zone and wire as a graph, read left to right: drag from a zone onto a thing or a lamp to wire it, click a wire to change it.', { left: 'Open the graph', right: 'Open the graph', options: { label: 'New wires do', palette: 'wire', source: 'wires' } }),
      p('gate-relay', 'Gate Relay', 'GitBranch', todo('logic', 'v3-gate')),
      p('actor-factory', 'Actor Factory', 'Factory', todo('logic', 'v3-factory')),
      p('debug-probe', 'Debug Probe', 'Bug', todo('logic', 'v3-probe')),
    ], filters: [f('Overlap Events'), f('Hit Events'), f('Blackboard Flags'), f('Logic AND/OR/Branch')],
    modifiers: [m('Shift+Drag', 'Wire Pin to Target'), m('Alt+Click', 'Sever Signal Line')] },
  },
  {
    key: 'F8',
    game: { name: 'Photo Cam', icon: 'Camera', look: 'Snap Camera', presets: [
      btn('instant-polaroid', 'Instant Polaroid', 'Takes a photo of the view (without the buttons) and keeps it.', 'Camera', b('camera', 'cam-photo')),
      btn('selfie-stick', 'Selfie Stick', 'The camera flips to face you; your goblin strikes a pose.', 'Smile', todo('camera', 'v3-selfie')),
      btn('flying-drone', 'Flying Drone', 'Fly a little camera round the island (B lands it).', 'Plane', b('camera', 'studio'), { left: 'Take off', right: 'Take off' }),
      btn('slow-mo-cam', 'Slow-Mo Cam', 'The clock slows: the world drops to 20% speed for stunts; again brings it back.', 'Timer', b('camera', 'cam-slowmo')),
    ] },
    simplified: { name: 'Camera', title: 'Camera & Cutscenes', icon: 'Camera', subtools: [
      sub('camera-placer', 'Camera Placer', 'Video', [range('fov', 'Field of View', 30, 110, '°', 60), range('blur', 'Blur Background', 0, 100, '%', 0)], [
        p('cinematic', 'Cinematic 16:9', 'Film', todo('camera', 'v3-camera-placer')),
        p('close-up', 'Close-up Portrait', 'User', todo('camera', 'v3-camera-placer')),
        p('wide-scenic', 'Wide Scenic View', 'Mountain', todo('camera', 'v3-camera-placer')),
      ]),
      sub('fly-through', 'Fly-Through Track', 'Orbit', [range('duration', 'Flight Duration', 1, 60, 's', 8, 1, 'orbit-time'), range('smoothness', 'Smoothness', 1, 100, '%', 80)], [
        p('gentle-pan', 'Gentle Pan', 'MoveHorizontal', todo('camera', 'v3-pan')),
        p('fast-flyby', 'Fast Flyby', 'Plane', todo('camera', 'v3-flyby')),
        p('spin-around', 'Spin Around Object', 'Orbit', b('camera', 'cam-orbit')),
      ]),
    ] },
    advanced: { name: 'Camera', icon: 'Camera', tools: [
      p('cine-dolly', 'Cine Dolly Camera', 'Film', todo('camera', 'v3-dolly')),
      p('boom-arm', 'Boom Arm', 'Crosshair', todo('camera', 'v3-boom')),
      p('ortho-blueprint', 'Ortho Blueprint', 'Grid3x3', todo('camera', 'v3-ortho')),
      p('viewport-bookmark', 'Viewport Bookmark', 'Bookmark', todo('camera', 'v3-bookmark')),
    ], filters: [f('Sensor Size 35mm'), f('Aperture f/1.4-f/22'), f('ISO'), f('Focal Length 14-200mm')],
    modifiers: [m('Shift+1..9', 'Save Slot'), m('1..9', 'Recall Slot (holding Viewport Bookmark)'), m('Alt+P', 'Pilot Mode')] },
  },
  {
    key: 'F9',
    game: { name: 'Toy Box', icon: 'Gift', look: 'Friend & Creature Spawner', presets: [
      btn('playful-pet', 'Playful Pet', 'A little goblin friend that follows you round.', 'PawPrint', b('characters', 'chars-spawn', { characters: 'follow' })),
      btn('bouncing-dummy', 'Bouncing Dummy', 'A dummy goblin that stands where you put it (its wobble when hit is coming).', 'PersonStanding', b('characters', 'chars-spawn', { characters: 'stand' })),
      btn('go-kart', 'Go-Kart Toy', 'A tiny car you jump into and drive straight away.', 'CarFront', todo('characters', 'v3-kart')),
      btn('target-practice', 'Target Practice', 'A wooden bullseye that flips back when struck.', 'Target', todo('characters', 'v3-target')),
      btn('respawn-flag', 'Respawn Flag', 'Plant a colourful flag; fireworks launch when you touch it.', 'Flag', todo('characters', 'v3-flag')),
    ] },
    simplified: { name: 'Characters', title: 'Characters & Simple AI', icon: 'Users', subtools: [
      sub('spawn-character', 'Spawn Character', 'UserPlus', [range('health', 'Health', 1, 1000, '', 100), range('move-speed', 'Movement Speed', 1, 10, 'm/s', 2)], [
        p('player-start', 'Player Start Point', 'Flag', todo('characters', 'v3-start')),
        p('friendly-npc', 'Friendly NPC', 'Smile', b('characters', 'chars-spawn', { characters: 'stand' })),
        p('wandering-animal', 'Wandering Animal', 'PawPrint', b('characters', 'chars-spawn', { characters: 'wander' })),
        p('guard-enemy', 'Guard Enemy', 'Shield', b('characters', 'chars-spawn', { characters: 'patrol' })),
      ]),
      sub('ai-behavior', 'AI Behavior', 'BrainCircuit', [range('sight', 'Sight Distance', 5, 50, 'm', 12), range('reaction', 'Reaction Delay', 0.1, 2, 's', 0.4, 0.1)], [
        p('stand-still', 'Stand Still', 'PersonStanding', b('characters', 'chars-change', { characters: 'stand' })),
        p('patrol-line', 'Patrol Line', 'Repeat', b('characters', 'chars-change', { characters: 'patrol' })),
        p('chase-player', 'Chase Player', 'Target', b('characters', 'chars-change', { characters: 'chase' })),
        p('flee-player', 'Flee from Player', 'Wind', b('characters', 'chars-change', { characters: 'flee' })),
      ]),
    ] },
    advanced: { name: 'Avatars', icon: 'Users', tools: [
      p('spawn-point', 'Spawn Point', 'UserPlus', b('characters', 'chars-spawn', { characters: 'stand' }), 'A goblin where you point, behaving as the options say.', { options: { label: 'Behaves', palette: 'characters', source: 'brains' } }),
      p('waypoint-spline', 'Waypoint Spline', 'Route', b('animate', 'anim-path', { walk: 'loop' })),
      p('socket-anchor', 'Socket Anchor', 'Anchor', todo('characters', 'v3-socket')),
      p('ragdoll-joint', 'Ragdoll Joint', 'Bone', todo('characters', 'v3-ragdoll')),
      p('ai-tree', 'AI Tree', 'Network', b('characters', 'chars-change', { characters: 'wander' }), 'Give the goblin you point at the behaviour the options say.', { options: { label: 'Behaves', palette: 'characters', source: 'brains' } }),
    ], filters: [f('Team Tags'), f('Behavior Trees'), f('Sockets (Weapon/Hand/Spine)'), f('Hitboxes')],
    modifiers: [m('Alt+Drag', 'Duplicate Patrol Waypoint'), m('G', 'Toggle Game View Gizmos')] },
  },
  {
    key: 'F10',
    game: { name: 'Dirt and Trees', icon: 'Shovel', look: 'Sandbox & Shovel', presets: [
      btn('mound-builder', 'Mound Builder', 'The ground balloons upward under the cursor.', 'Mountain', b('sculpt', 'raise')),
      btn('pit-digger', 'Pit Digger', 'The ground sinks into a swimming hole or a moat.', 'ArrowDownToLine', b('sculpt', 'lower')),
      btn('lawn-roller', 'Lawn Roller', 'A giant roller leaves neat grass behind.', 'Sprout', b('paint', 'paint-brush', { paint: '4' }), { left: 'Roll out grass', right: 'Roll out grass' }),
      btn('plant-oak', 'Plant Oak Tree', 'A tree sprouts where you point (a palm until the oak is made).', 'TreeDeciduous', b('things', 'things-one', { things: 'palm' })),
      btn('flower-sprinkler', 'Flower Sprinkler', 'Flowers pop open round where you point.', 'Flower2', b('things', 'things-scatter', { things: 'flowers' })),
      // V3.1: water
      btn('creek-digger', 'Creek Digger', 'Click along where the stream goes, then the last spot again: it digs the bed and the water fills it.', 'Waves', b('sculpt', 'terrain-river')),
    ] },
    simplified: { name: 'Terrain', title: 'Ground & Foliage', icon: 'Mountain', subtools: [
      sub('ground-sculptor', 'Ground Sculptor', 'Mountain', [range('brush-width', 'Brush Width', 1, 100, 'm', 12, 1, 'tool-width'), range('speed', 'Raise/Lower Speed', 1, 100, '%', 50, 1, 'tool-strength')], [
        p('make-mountain', 'Make Mountain', 'Mountain', b('sculpt', 'raise')),
        p('dig-valley', 'Dig Valley', 'ArrowDownToLine', b('sculpt', 'lower')),
        p('flat-plateau', 'Flat Plateau', 'Minus', b('sculpt', 'flatten')),
        p('smooth-bumps', 'Smooth Bumps', 'Waves', b('sculpt', 'smooth')),
      ]),
      sub('plant-scatter', 'Plant Scatter', 'Sprout', [range('density', 'Forest Density', 1, 100, '%', 50, 1, 'density'), range('randomness', 'Size Randomness', 0, 100, '%', 30)], [
        p('lawn-grass', 'Lawn Grass', 'Sprout', b('things', 'things-scatter', { things: 'grass-clump' })),
        p('dense-forest', 'Dense Forest', 'Trees', b('things', 'things-scatter', { things: 'palm' })),
        p('river-rocks', 'River Rocks', 'Gem', b('things', 'things-scatter', { things: 'rock' })),
        p('desert-cactus', 'Desert Cactus', 'Sprout', todo('things', 'v3-cactus')),
      ]),
      // V3.1: roads, rivers and rain wear (built for Advanced F10 only)
      sub('paths-water', 'Paths & Water', 'Route', [], [
        p('dirt-path', 'Dirt Path', 'Footprints', b('sculpt', 'terrain-road', { road: '22' }), 'Click along where the path goes, then the last point again.'),
        p('stone-road', 'Stone Road', 'Route', b('sculpt', 'terrain-road', { road: '24' }), 'Click along where the road goes, then the last point again.'),
        p('river', 'River', 'Waves', b('sculpt', 'terrain-river'), 'Click from where it starts to where it ends, then the last point again.'),
        p('rain-wear', 'Rain Wear', 'CloudRain', b('sculpt', 'terrain-rain'), 'Rain where you point: little gullies form and soil washes down.'),
      ]),
    ] },
    advanced: { name: 'Terrain', icon: 'Mountain', tools: [
      p('heightmap-sculpt', 'Heightmap Sculpt', 'Mountain', b('sculpt', 'raise')),
      p('hydraulic-erosion', 'Hydraulic Erosion', 'CloudRain', b('sculpt', 'terrain-rain')),
      p('spline-road-river', 'Spline Road/River', 'Route', b('sculpt', 'terrain-road')),
      p('biome-scatter', 'Biome Scatter', 'Trees', b('things', 'things-scatter', { things: 'palm' }), 'Scatter plants round where you point.', { options: { label: 'Plant', palette: 'things', source: 'plants' } }),
    ], filters: [f('Slope Constraints (>45° Stone)'), f('Altitude Masks'), f('Triplanar Blends')],
    modifiers: [m('Ctrl+Drag', 'Carve Canyon'), m('Shift+Paint', 'Density Trim'), m('Ctrl+Wheel', 'Density')] },
  },
  {
    key: 'F11',
    game: { name: 'Physics Play', icon: 'Balloon', look: 'Bouncy Ball & Float', presets: [
      btn('super-bouncy', 'Super Bouncy', "Tap a thing: it rebounds wildly off surfaces with a rubbery 'BOING'.", 'CircleDot', b('physics', 'phys-give', { physics: 'rubber' })),
      btn('zero-friction', 'Zero Friction', 'Tap a thing: it slides across the floor like a wet puck on ice.', 'Snowflake', b('physics', 'phys-give', { physics: 'ice' })),
      btn('tether-balloon', 'Tether Balloon', 'Tap a thing: it floats gently up like a helium balloon.', 'Balloon', b('physics', 'phys-give', { physics: 'balloon' })),
      btn('super-anvil', 'Super Anvil', 'Tap a thing: it weighs 10,000 kg, falls like lead and cannot be nudged.', 'Anvil', b('physics', 'phys-give', { physics: 'anvil' })),
      btn('push-hammer', 'Push Hammer', 'A giant hammer blow: nearby clutter goes flying.', 'Hammer', b('physics', 'phys-hammer')),
    ] },
    simplified: { name: 'Physics', title: 'Physics & Collisions', icon: 'Atom', subtools: [
      sub('solid-boundaries', 'Solid Boundaries', 'BrickWall', [range('thickness', 'Thickness', 0.05, 1, 'm', 0.2, 0.05)], [
        p('walk-through-ghost', 'Walk-Through Ghost', 'Ghost', todo('physics', 'v3-solid')),
        p('solid-wall', 'Solid Wall', 'BrickWall', todo('physics', 'v3-solid')),
        p('invisible-barrier', 'Invisible Barrier', 'Shield', todo('physics', 'v3-solid')),
        p('climbable-ladder', 'Climbable Ladder', 'ChartNoAxesColumnIncreasing', todo('physics', 'v3-solid')),
      ]),
      sub('physical-material', 'Physical Material', 'Atom', [range('bounciness', 'Bounciness', 0, 100, '%', 30), range('heaviness', 'Heaviness', 0.1, 1000, 'kg', 100, 0.1), range('friction', 'Friction/Grip', 0, 100, '%', 60)], [
        p('normal-wood', 'Normal Wood', 'TreeDeciduous', b('physics', 'phys-give', { physics: 'wood' })),
        p('bouncy-rubber', 'Super Bouncy Rubber', 'CircleDot', b('physics', 'phys-give', { physics: 'rubber' })),
        p('slippery-ice', 'Slippery Ice', 'Snowflake', b('physics', 'phys-give', { physics: 'ice' })),
        p('heavy-metal', 'Heavy Metal', 'Weight', b('physics', 'phys-give', { physics: 'metal' })),
      ]),
    ] },
    advanced: { name: 'Physics', icon: 'Atom', tools: [
      p('convex-hull', 'Convex Hull Auto-Fit', 'Hexagon', todo('physics', 'v3-hull')),
      p('joint-hinge', 'Physics Joint Hinge', 'Link', todo('physics', 'v3-hinge')),
      p('navmesh-bounds', 'NavMesh Bounds', 'Grid3x3', todo('physics', 'v3-navmesh')),
      p('force-field', 'Force Field', 'Magnet', b('physics', 'phys-hammer'), 'A push where you point: everything nearby is thrown outwards (heavy things hardly move).'),
    ], filters: [f('Kinematic / Dynamic'), f('Elasticity'), f('Static Friction'), f('NavMesh Cost Area')],
    modifiers: [m('P', 'Trigger Live Physics Simulation'), m('Shift+P', 'Reset Transforms')] },
  },
  {
    key: 'F12',
    game: { name: 'Magic Wand', icon: 'WandSparkles', look: 'Magic Sparkles', presets: [
      btn('firework-launcher', 'Firework Launcher', 'Fires celebratory bursts of multicoloured star sparks.', 'PartyPopper', b('effects', 'effects-once', { effects: 'firework' })),
      btn('bonfire-flame', 'Bonfire Flame', 'Summons a cosy crackling fire with dancing embers.', 'Flame', b('effects', 'effects-place', { effects: 'campfire' })),
      btn('bubble-stream', 'Bubble Stream', 'A continuous flow of soap bubbles.', 'CircleDot', b('effects', 'effects-place', { effects: 'bubbles' })),
      btn('dust-cloud', 'Dust Cloud', 'Puffs a cloud of soft smoke that lingers and fades.', 'Wind', b('effects', 'effects-once', { effects: 'smoke' })),
      btn('shooting-star', 'Shooting Star Trail', 'Draws a glowing ribbon of light that traces your movements.', 'Sparkles', todo('effects', 'v3-trail')),
    ] },
    simplified: { name: 'Effects', title: 'Visual VFX & Atmosphere', icon: 'Sparkles', subtools: [
      sub('particle-spawner', 'Particle Spawner', 'Sparkles', [range('effect-size', 'Effect Size', 0.1, 10, 'm', 2, 0.1, 'effect-size'), range('count', 'Particle Count', 1, 500, '', 120), range('particle-speed', 'Particle Speed', 1, 100, '%', 50)], [
        p('campfire-smoke', 'Campfire & Smoke', 'Flame', b('effects', 'effects-place', { effects: 'campfire' })),
        p('falling-snow', 'Falling Snow', 'Snowflake', b('effects', 'effects-place', { effects: 'snow' })),
        p('torrential-rain', 'Torrential Rain', 'CloudRain', b('effects', 'effects-place', { effects: 'rain' })),
        p('dust-sparks', 'Dust Sparks', 'Sparkles', b('effects', 'effects-place', { effects: 'sparks' })),
      ]),
      sub('screen-mood', 'Screen Mood Filter', 'Aperture', [range('filter-strength', 'Filter Strength', 0, 100, '%', 60), range('vignette', 'Screen Vignette', 0, 100, '%', 30)], [
        p('warm-vintage', 'Warm Vintage', 'Sun', todo('effects', 'v3-mood')),
        p('cold-scifi', 'Cold Sci-Fi', 'Snowflake', todo('effects', 'v3-mood')),
        p('horror-dark', 'Horror Dark', 'Moon', todo('effects', 'v3-mood')),
        p('retro-arcade', 'Retro Arcade Comic', 'Gamepad2', todo('effects', 'v3-mood')),
      ]),
    ] },
    advanced: { name: 'Materials & VFX', icon: 'Sparkles', tools: [
      p('material-sampler', 'Material Sampler', 'Pipette', todo('effects', 'v3-sampler')),
      p('post-process-volume', 'Post-Process Volume', 'Aperture', todo('effects', 'v3-postvolume')),
      p('niagara-system', 'Niagara System', 'Sparkles', b('effects', 'effects-place', { effects: 'sparks' }), 'A particle effect where you point; it keeps going.', { options: { label: 'Effect', palette: 'effects', source: 'effects' } }),
      p('triplanar-uv', 'Triplanar UV', 'Grid3x3', todo('effects', 'v3-triplanar-uv')),
    ], filters: [f('LUT Color Grading'), f('Depth of Field Bokeh'), f('GTAO'), f('Cel-Shade'), f('Niagara GPU')],
    modifiers: [m('Shift+Click', 'Propagate Material'), m('R', 'Re-trigger Particle Burst')] },
  },
];

/** The tab of a key: F1..F12 (Shift+F1 and Shift+F2 also open F11 and F12, which browsers keep for themselves), or null. */
export function v3TabForKey(key: string, shift = false): number | null {
  if (shift && (key === 'F1' || key === 'F2')) return key === 'F1' ? 10 : 11;
  const r = /^F(\d{1,2})$/.exec(key);
  if (!r) return null;
  const n = Number(r[1]);
  return n >= 1 && n <= 12 ? n - 1 : null;
}
/** What a tab is called in a mode. */
export const v3TabName = (t: V3Tab, mode: V3Mode): string => (mode === 'game' ? t.game.name : mode === 'simplified' ? t.simplified.name : t.advanced.name);
export const v3TabIcon = (t: V3Tab, mode: V3Mode): string => (mode === 'game' ? t.game.icon : mode === 'simplified' ? t.simplified.icon : t.advanced.icon);
/** The slots of a tab's hotbar in a mode: Game's presets, Simplified's sub-tools, Advanced's tools. */
export interface V3Slot { readonly id: string; readonly name: string; readonly icon: string; readonly doc: string; readonly todo: boolean }
export function v3Slots(t: V3Tab, mode: V3Mode): readonly V3Slot[] {
  if (mode === 'game') return t.game.presets.map((q) => ({ id: q.id, name: q.name, icon: q.icon, doc: q.doc, todo: q.bind.todo === true }));
  if (mode === 'simplified') return t.simplified.subtools.map((s) => ({ id: s.id, name: s.name, icon: s.icon, doc: s.presets.map((q) => q.name).join(', '), todo: s.presets.every((q) => q.bind.todo === true) }));
  return t.advanced.tools.map((q) => ({ id: q.id, name: q.name, icon: q.icon, doc: q.doc, todo: q.bind.todo === true }));
}
/**
 * The button in hand: Game's preset, Simplified's preset within the sub-tool (its first by default), Advanced's tool (or, on F3, the preset
 * picked under the tools: `preset` >= 0).
 */
export function v3Button(t: V3Tab, mode: V3Mode, slot: number, preset = 0): V3Button | null {
  if (mode === 'game') return t.game.presets[slot] ?? null;
  if (mode === 'simplified') { const s = t.simplified.subtools[slot]; return s ? s.presets[preset] ?? s.presets[0] ?? null : null; }
  if (preset >= 0 && t.advanced.presets?.[preset]) return t.advanced.presets[preset]!;
  return t.advanced.tools[slot] ?? null;
}
/** Every button of a mode, for Find a tool: where it lives (tab, slot, preset) and its name. */
export interface V3Found { readonly tab: number; readonly slot: number; readonly preset: number; readonly name: string; readonly where: string; readonly todo: boolean }
export function v3Find(mode: V3Mode): readonly V3Found[] {
  const out: V3Found[] = [];
  V3_TABS.forEach((t, ti) => {
    const tab = `${t.key} ${v3TabName(t, mode)}`;
    if (mode === 'game') t.game.presets.forEach((q, i) => out.push({ tab: ti, slot: i, preset: 0, name: q.name, where: tab, todo: q.bind.todo === true }));
    else if (mode === 'simplified') t.simplified.subtools.forEach((s, i) => s.presets.forEach((q, j) => out.push({ tab: ti, slot: i, preset: j, name: q.name, where: `${tab}, ${s.name}`, todo: q.bind.todo === true })));
    else {
      t.advanced.tools.forEach((q, i) => out.push({ tab: ti, slot: i, preset: -1, name: q.name, where: tab, todo: q.bind.todo === true }));
      t.advanced.presets?.forEach((q, j) => out.push({ tab: ti, slot: 0, preset: j, name: q.name, where: `${tab}, presets`, todo: q.bind.todo === true }));
    }
  });
  return out;
}
/** A search match: every word of the query starts a word of the name (case-insensitive). */
export function v3Matches(name: string, query: string): boolean {
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const q = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return q.length > 0 && q.every((w) => words.some((n) => n.startsWith(w)));
}
