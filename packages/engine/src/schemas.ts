import { defineSchema, type ChildSlot, type SchemaRegistry, type VariableDef } from '@hm/contracts';

/** The core preset kinds the harness ships with. Games add their own kinds on top (racer, track-piece, item ...). */

const num = (key: string, label: string, doc: string, def: number, tier: VariableDef['tier'], o: Partial<VariableDef> = {}): VariableDef =>
  ({ key, type: 'number', label, doc, tier, default: def, ...o });

const MATERIAL_VARS: readonly VariableDef[] = [
  { key: 'color', type: 'color', label: 'Colour', doc: 'Base colour of the surface.', tier: 'play', default: '#cccccc', group: 'Look' },
  num('roughness', 'Roughness', '0 = mirror, 1 = chalk.', 0.6, 'build', { min: 0, max: 1, step: 0.01, group: 'Look' }),
  num('metalness', 'Metalness', '0 = plastic or stone, 1 = bare metal.', 0, 'build', { min: 0, max: 1, step: 0.01, group: 'Look' }),
  { key: 'albedo', type: 'asset', label: 'Colour map', doc: 'Texture file for the colour (optional).', tier: 'pro', default: '', group: 'Maps' },
  { key: 'normal', type: 'asset', label: 'Normal map', doc: 'Texture file for fine bumps (optional).', tier: 'pro', default: '', group: 'Maps' },
  { key: 'orm', type: 'asset', label: 'ORM map', doc: 'Occlusion / roughness / metal packed in R, G, B (optional).', tier: 'pro', default: '', group: 'Maps' },
  num('repeat', 'Tiling', 'How many times the maps repeat across the surface.', 1, 'pro', { min: 0.01, max: 256, step: 0.1, group: 'Maps' }),
  num('normalStrength', 'Bump strength', 'How strong the normal map looks.', 1, 'pro', { min: 0, max: 4, step: 0.05, group: 'Maps' }),
];

export const materialSchema = defineSchema({
  kind: 'material',
  version: 1,
  label: 'Material',
  doc: 'How a surface looks: colour, shine and optional texture maps.',
  icon: 'material',
  variables: MATERIAL_VARS,
  slots: [] as readonly ChildSlot[],
});

export const entitySchema = defineSchema({
  kind: 'entity',
  version: 1,
  label: 'Object',
  doc: 'Something in the world: a shape with a place, a look and optionally physics.',
  icon: 'cube',
  variables: [
    { key: 'shape', type: 'enum', label: 'Shape', doc: 'The basic shape.', tier: 'play', default: 'box', options: ['sphere', 'box', 'cylinder', 'plane'], group: 'Shape' },
    num('size', 'Size', 'Radius (sphere, cylinder) or half width (box, plane) in metres.', 0.5, 'play', { min: 0.01, max: 500, step: 0.05, unit: 'm', group: 'Shape' }),
    num('x', 'X', 'Position left/right.', 0, 'build', { step: 0.1, unit: 'm', group: 'Place' }),
    num('y', 'Y', 'Position up/down.', 0, 'build', { step: 0.1, unit: 'm', group: 'Place' }),
    num('z', 'Z', 'Position forward/back.', 0, 'build', { step: 0.1, unit: 'm', group: 'Place' }),
    num('yaw', 'Turn', 'Rotation around the up axis.', 0, 'build', { min: -180, max: 180, step: 1, unit: 'deg', group: 'Place' }),
    num('scaleX', 'Stretch X', 'Scale along X.', 1, 'pro', { min: 0.01, max: 100, step: 0.05, group: 'Place' }),
    num('scaleY', 'Stretch Y', 'Scale along Y.', 1, 'pro', { min: 0.01, max: 100, step: 0.05, group: 'Place' }),
    num('scaleZ', 'Stretch Z', 'Scale along Z.', 1, 'pro', { min: 0.01, max: 100, step: 0.05, group: 'Place' }),
    { key: 'material', type: 'ref', label: 'Material', doc: 'A material preset; its look overrides the colour below.', tier: 'build', default: null, refKinds: ['material'], group: 'Look' },
    ...MATERIAL_VARS.slice(0, 3).map((v) => ({ ...v, tier: v.key === 'color' ? 'play' as const : v.tier })),
    { key: 'visible', type: 'boolean', label: 'Visible', doc: 'Hide or show it.', tier: 'build', default: true, group: 'Look' },
    { key: 'body', type: 'enum', label: 'Physics', doc: 'none = decoration, static = solid and fixed, dynamic = moves and rolls.', tier: 'build', default: 'none', options: ['none', 'static', 'dynamic'], group: 'Physics' },
    num('mass', 'Mass', 'Heavier things are harder to push.', 1, 'build', { min: 0.01, max: 1000, step: 0.1, unit: 'kg', group: 'Physics' }),
    num('friction', 'Grip', 'How much it grips surfaces.', 0.5, 'build', { min: 0, max: 2, step: 0.01, group: 'Physics' }),
    num('restitution', 'Bounce', '0 = thud, 1 = perfect bounce.', 0, 'build', { min: 0, max: 1, step: 0.01, group: 'Physics' }),
  ],
  slots: [] as readonly ChildSlot[],
});

export const sceneSchema = defineSchema({
  kind: 'scene',
  version: 1,
  label: 'Scene',
  doc: 'A place: the objects in it, the camera and the light.',
  icon: 'scene',
  variables: [
    num('gravity', 'Gravity', 'Downward pull in m/s squared (9.81 is Earth).', 9.81, 'build', { min: 0, max: 60, step: 0.1, unit: 'm/s2' }),
    num('seed', 'Random seed', 'Same seed, same game: used by everything random.', 1, 'pro', { min: 0, max: 4294967295, step: 1 }),
    { key: 'camera', type: 'ref', label: 'Camera', doc: 'Which camera preset looks at this scene.', tier: 'build', default: null, refKinds: ['camera'] },
    { key: 'look', type: 'enum', label: 'Look', doc: 'The mood of the scene: sky, sun, fog and colour.', tier: 'play', default: 'noon-clear', options: ['noon-clear', 'golden-hour', 'sunset-blaze', 'tropical-dawn', 'overcast-day', 'storm-front', 'blue-hour', 'moonlit-night', 'volcanic-ash', 'neon-dusk'] },
    num('timeOfDay', 'Time of day', 'Hour of the day (0-24); -1 uses the look as it is.', -1, 'build', { min: -1, max: 24, step: 0.1, unit: 'h' }),
    { key: 'track', type: 'ref', label: 'Race track', doc: 'The track raced in this scene.', tier: 'build', default: null, refKinds: ['track'] },
  ],
  slots: [
    { key: 'entities', label: 'Objects', doc: 'Everything placed in this scene.', kinds: ['entity'], min: 0, max: null, tier: 'play' },
    { key: 'decor', label: 'Foliage', doc: 'Palms, bushes and rocks.', kinds: ['decor'], min: 0, max: 1, tier: 'build' },
    { key: 'terrain', label: 'Ground', doc: 'The island or arena floor.', kinds: ['terrain'], min: 0, max: 1, tier: 'build' },
    { key: 'modulators', label: 'Drivers', doc: 'Randomizers, LFOs, curves, timelines and data streams that drive any variable while the game runs.', kinds: ['modulator'], min: 0, max: null, tier: 'build' },
    { key: 'items', label: 'Items', doc: 'The power-ups racers can pick up. Empty = the standard eight.', kinds: ['item'], min: 0, max: null, tier: 'build' },
    { key: 'views', label: 'Editing view', doc: 'How the world looks while you focus on one thing: the white-out and blur, and the orbit or fly camera.', kinds: ['veil'], min: 0, max: 1, tier: 'play' },
    { key: 'rigs', label: 'Camera rigs', doc: 'The ways to watch this scene: chase, first person, orbit, helicopter, free, ghost, director.', kinds: ['camera-rig'], min: 0, max: null, tier: 'play' },
    { key: 'models', label: 'Models', doc: 'Voxel models used in this scene: characters, props, statues.', kinds: ['model'], min: 0, max: null, tier: 'build' },
    { key: 'interface', label: 'Interface', doc: 'The look and wording of the menus and the HUD: colours, texts, which HUD parts show.', kinds: ['interface'], min: 0, max: 1, tier: 'play' },
    { key: 'rules', label: 'Race rules', doc: 'How the race is run: laps, field size, items, boost pads. Change it to make your own kind of race.', kinds: ['race'], min: 0, max: 1, tier: 'play' },
    { key: 'sounds', label: 'Sounds', doc: 'Edited sound effects, engine hums and music for this scene. Anything not listed uses the built-in sound.', kinds: ['sound', 'engine-sound', 'music'], min: 0, max: null, tier: 'play' },
    { key: 'mechanics', label: 'Behaviours', doc: 'Scripts that run every tick: rules, controls, items, AI.', kinds: ['mechanic', 'rule', 'item', 'ai-driver', 'racer'], min: 0, max: null, tier: 'build' },
  ] as readonly ChildSlot[],
});

export const cameraSchema = defineSchema({
  kind: 'camera',
  version: 1,
  label: 'Camera',
  doc: 'Where the player looks from.',
  icon: 'camera',
  variables: [
    num('fov', 'Field of view', 'Wider sees more but bends edges.', 50, 'build', { min: 20, max: 110, step: 1, unit: 'deg' }),
    num('distance', 'Distance', 'How far the camera sits from its target.', 18, 'build', { min: 0.5, max: 2000, step: 0.5, unit: 'm' }),
    num('yaw', 'Turn', 'Angle around the target.', 0.6, 'build', { min: -6.3, max: 6.3, step: 0.05, unit: 'rad' }),
    num('pitch', 'Tilt', 'Angle above the horizon.', 0.5, 'build', { min: -1.5, max: 1.5, step: 0.05, unit: 'rad' }),
    num('targetX', 'Look at X', 'Target X.', 0, 'pro', { step: 0.5, unit: 'm' }),
    num('targetY', 'Look at Y', 'Target Y.', 0, 'pro', { step: 0.5, unit: 'm' }),
    num('targetZ', 'Look at Z', 'Target Z.', 0, 'pro', { step: 0.5, unit: 'm' }),
  ],
  slots: [] as readonly ChildSlot[],
});

export const terrainSchema = defineSchema({
  kind: 'terrain',
  version: 1,
  label: 'Terrain',
  doc: 'The ground: a height grid with painted surfaces. Edited with the sculpt and paint brushes.',
  icon: 'terrain',
  variables: [
    { key: 'data', type: 'asset', label: 'Terrain data', doc: 'Heights and painted surfaces (edited with the brushes, not by hand).', tier: 'pro', default: null },
    num('soft', 'Soft borders', '0 = crisp edges between surfaces, 1 = long soft fades.', 0.6, 'build', { min: 0, max: 1, step: 0.05, group: 'Look' }),
    num('bump', 'Bump strength', 'How strong the surface relief looks.', 1, 'build', { min: 0, max: 3, step: 0.05, group: 'Look' }),
    num('friction', 'Grip', 'How much the ground grips rolling things.', 0.8, 'build', { min: 0, max: 2, step: 0.01, group: 'Physics' }),
    num('restitution', 'Bounce', '0 = thud, 1 = perfect bounce.', 0, 'build', { min: 0, max: 1, step: 0.01, group: 'Physics' }),
  ],
  slots: [] as readonly ChildSlot[],
});

export const trackSchema = defineSchema({
  kind: 'track',
  version: 1,
  label: 'Race track',
  doc: 'The racing line: control points the road is drawn through, and how wide it is.',
  icon: 'track',
  variables: [
    { key: 'points', type: 'list', label: 'Control points', doc: 'The points the road passes through (edited with the Track tool).', tier: 'pro', default: [], itemType: 'vec2' },
    num('width', 'Road width', 'How wide the road is.', 12, 'build', { min: 4, max: 40, step: 0.5, unit: 'm' }),
    { key: 'closed', type: 'boolean', label: 'Closed loop', doc: 'A closed track is a circuit you lap.', tier: 'build', default: true },
    num('laps', 'Laps', 'How many laps a race lasts.', 3, 'play', { min: 1, max: 20, step: 1 }),
  ],
  slots: [] as readonly ChildSlot[],
});

export const decorSchema = defineSchema({
  kind: 'decor',
  version: 1,
  label: 'Foliage and rocks',
  doc: 'Palms, bushes, boulders and tufts scattered over the island by the Dress tool.',
  icon: 'tree',
  variables: [
    num('seed', 'Random seed', 'Change it for a different arrangement.', 1, 'build', { min: 0, max: 99999, step: 1 }),
    num('density', 'Density', 'More or fewer plants (1 = the default).', 1, 'play', { min: 0, max: 2, step: 0.05 }),
    { key: 'kinds', type: 'list', label: 'Prop kinds', doc: 'Which prop each placement is.', tier: 'pro', default: [], itemType: 'string' },
    { key: 'items', type: 'list', label: 'Placements', doc: 'kind index, x, y, z, yaw, scale for every prop.', tier: 'pro', default: [], itemType: 'number' },
  ],
  slots: [] as readonly ChildSlot[],
});

export const mechanicSchema = defineSchema({
  kind: 'mechanic',
  version: 1,
  label: 'Behaviour',
  doc: 'A small script that runs every tick. Game kinds (racer, rule, item ...) extend this idea with their own settings.',
  icon: 'script',
  scriptInterface: 'Mechanic',
  variables: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', doc: 'Switch the behaviour off without deleting it.', tier: 'build', default: true },
  ],
  slots: [] as readonly ChildSlot[],
});

export const modulatorSchema = defineSchema({
  kind: 'modulator',
  version: 1,
  label: 'Driver',
  doc: 'Moves a variable by itself while the game runs: a random wobble, a wave, a curve, a timeline, a step sequence, another value or a texture.',
  icon: 'wave',
  variables: [
    { key: 'target', type: 'string', label: 'Drives', doc: 'The variable it moves, e.g. entity:5/transform.y or <preset>.<setting>.', tier: 'build', default: '' },
    { key: 'def', type: 'string', label: 'Shape', doc: 'What it does (edited with the driver panel).', tier: 'build', default: '{"kind":"lfo","wave":"sine","freqHz":0.5,"out":{"min":0,"max":1}}' },
    { key: 'mode', type: 'enum', label: 'Mode', doc: 'replace = the driver sets the value; add = adds to what it was; scale = multiplies what it was.', tier: 'build', default: 'replace', options: ['replace', 'add', 'scale'] },
    num('amount', 'Amount', '0 = no effect, 1 = full effect.', 1, 'play', { min: 0, max: 1, step: 0.01 }),
    { key: 'enabled', type: 'boolean', label: 'Enabled', doc: 'Switch the driver off without deleting it.', tier: 'play', default: true },
  ],
  slots: [] as readonly ChildSlot[],
});

const colour = (key: string, label: string, doc: string, def: string, group: string): VariableDef => ({ key, type: 'color', label, doc, tier: 'play', default: def, group });
const text = (key: string, label: string, doc: string, def: string, group: string): VariableDef => ({ key, type: 'string', label, doc, tier: 'play', default: def, group });
const flag = (key: string, label: string, doc: string, group: string): VariableDef => ({ key, type: 'boolean', label, doc, tier: 'play', default: true, group });

export const interfaceSchema = defineSchema({
  kind: 'interface',
  version: 1,
  label: 'Interface',
  doc: 'How the game looks to the player: colours, wording, sizes and which HUD parts are shown. The menus, the HUD and the editor itself read these variables.',
  icon: 'palette',
  variables: [
    { key: 'theme', type: 'enum', label: 'Theme', doc: 'The overall look. white-wall is a clean painted wall with marker doodles and spray paint; night-wall is the same on dark concrete; high-contrast is plain and easy to read; classic-dark is the original dark look. A colour you change below always wins over the theme.', tier: 'play', default: 'white-wall', options: ['white-wall', 'night-wall', 'high-contrast', 'classic-dark'], group: 'Look' },
    { key: 'doodles', type: 'boolean', label: 'Doodles', doc: 'Marker doodles and spray splats in the margins of panels and menus.', tier: 'play', default: true, group: 'Look' },
    colour('accent', 'Accent', 'Highlights, the main button and the winner.', '#ffd24a', 'Colours'),
    colour('text', 'Text', 'Main text colour.', '#dde6ee', 'Colours'),
    colour('dim', 'Soft text', 'Hints and labels.', '#8fa0b1', 'Colours'),
    colour('panel', 'Panel', 'Panels and cards.', '#151a21', 'Colours'),
    colour('line', 'Lines', 'Borders and dividers.', '#26303b', 'Colours'),
    colour('ok', 'Good', 'Success and points gained.', '#5fd38d', 'Colours'),
    colour('danger', 'Warning', 'Errors and the last point.', '#ff6b5e', 'Colours'),
    text('title', 'Game title', 'The big title on the first screen.', 'GOBLIN BALL RACERS', 'Words'),
    text('subtitle', 'Subtitle', 'The line under the title.', 'Basalt Isle', 'Words'),
    text('quickLabel', 'Quick game button', 'Text on the quick race button.', 'Quick Race', 'Words'),
    text('seriesLabel', 'Series button', 'Text on the championship button.', 'Championship', 'Words'),
    { key: 'uiScale', type: 'number', label: 'Text size', doc: '1 = normal, 1.3 = large print.', tier: 'play', default: 1, min: 0.8, max: 1.6, step: 0.05, group: 'Sizes' },
    { key: 'hudLayout', type: 'enum', label: 'HUD layout', doc: 'Where the HUD parts sit. Pick a ready-made layout, or Custom to use your own (edit it below).', tier: 'play', default: 'classic', options: ['classic', 'minimal', 'kids', 'sim', 'custom'], group: 'HUD' },
    { key: 'hudLayoutJson', type: 'string', label: 'Custom HUD layout', doc: 'The layout used when HUD layout is Custom (edited with the HUD editor).', tier: 'pro', default: '', group: 'HUD' },
    flag('hudSpeed', 'Show speed', 'The speedometer.', 'HUD'),
    flag('hudLap', 'Show lap', 'Lap counter.', 'HUD'),
    flag('hudPosition', 'Show position', 'Race position.', 'HUD'),
    flag('hudTime', 'Show time', 'Race clock.', 'HUD'),
    flag('hudItem', 'Show item', 'The item you are holding.', 'HUD'),
  ],
  slots: [] as readonly ChildSlot[],
});

export const itemSchema = defineSchema({
  kind: 'item',
  version: 1,
  label: 'Race item',
  doc: 'A power-up: what it does, for how long, how strong, how far it reaches and how likely each part of the field is to get it.',
  icon: 'star',
  variables: [
    { key: 'label', type: 'string', label: 'Name', doc: 'Shown to the player.', tier: 'play', default: 'Item', group: 'Item' },
    { key: 'icon', type: 'string', label: 'Icon', doc: 'One emoji.', tier: 'play', default: '⭐', group: 'Item' },
    { key: 'effect', type: 'enum', label: 'Effect', doc: 'What it does. boost, jump, anchor, slipstream and ghost help you; oil is dropped behind you; shockwave and freeze hit everyone nearby.', tier: 'build', default: 'boost', options: ['boost', 'jump', 'oil', 'shockwave', 'anchor', 'slipstream', 'freeze', 'ghost'], group: 'Item' },
    num('durationMs', 'Lasts', 'How long the effect lasts.', 2500, 'play', { min: 0, max: 20000, step: 100, unit: 'ms', group: 'Strength' }),
    num('power', 'Power', '1 = as designed. Scales how hard it hits or pushes.', 1, 'play', { min: 0.25, max: 4, step: 0.05, group: 'Strength' }),
    num('radius', 'Reach', 'Metres affected (oil slick size, shockwave and freeze range).', 0, 'build', { min: 0, max: 80, step: 0.5, unit: 'm', group: 'Strength' }),
    num('weightFront', 'Chance up front', 'Relative chance for racers in the front third.', 2, 'build', { min: 0, max: 10, step: 0.5, group: 'Chance' }),
    num('weightMiddle', 'Chance in the middle', 'Relative chance for the middle third.', 2, 'build', { min: 0, max: 10, step: 0.5, group: 'Chance' }),
    num('weightBack', 'Chance at the back', 'Relative chance for the back third.', 2, 'build', { min: 0, max: 10, step: 0.5, group: 'Chance' }),
    { key: 'enabled', type: 'boolean', label: 'Enabled', doc: 'Switch the item off without deleting it.', tier: 'play', default: true, group: 'Item' },
  ],
  slots: [] as readonly ChildSlot[],
});

export const cameraRigSchema = defineSchema({
  kind: 'camera-rig',
  version: 1,
  label: 'Camera rig',
  doc: 'How a camera follows the action: chase, first person, orbit, helicopter, top down, free or ghost. Used for players, spectators and the TV director.',
  icon: 'camera',
  variables: [
    { key: 'rig', type: 'enum', label: 'Kind', doc: 'chase follows from behind, first-person sits in the goblin, orbit circles it, helicam flies round, topdown looks straight down, free and ghost are flown by hand.', tier: 'play', default: 'chase', options: ['chase', 'orbit', 'free', 'topdown', 'first-person', 'helicam', 'ghost', 'director'], group: 'Rig' },
    num('distance', 'Distance', 'How far behind or away the camera sits.', 6, 'play', { min: 0, max: 200, step: 0.5, unit: 'm', group: 'Position' }),
    num('height', 'Height', 'How high above the subject.', 2.5, 'play', { min: -20, max: 200, step: 0.5, unit: 'm', group: 'Position' }),
    num('lookAhead', 'Look ahead', 'How far in front of the subject the camera looks.', 4, 'build', { min: 0, max: 60, step: 0.5, unit: 'm', group: 'Position' }),
    num('stiffness', 'Follow speed', 'Low = floaty and smooth, high = glued to the subject.', 6, 'build', { min: 0.1, max: 60, step: 0.1, group: 'Feel' }),
    num('fov', 'Lens', 'Field of view. Small = zoomed in, big = wide.', 62, 'play', { min: 20, max: 120, step: 1, unit: 'deg', group: 'Feel' }),
    num('fovBoostPerSpeed', 'Zoom out with speed', 'Extra degrees of lens for every m/s of speed.', 0.25, 'build', { min: 0, max: 2, step: 0.01, group: 'Feel' }),
    num('shake', 'Shake', 'Speed and impact shake, 0 = none.', 0.2, 'play', { min: 0, max: 1, step: 0.01, group: 'Feel' }),
    num('orbitSpeed', 'Orbit speed', 'Radians per second for orbit and helicopter shots.', 0.3, 'build', { min: -3, max: 3, step: 0.01, group: 'Feel' }),
    { key: 'collideGround', type: 'boolean', label: 'Stay above ground', doc: 'Keep the camera from sinking into the island.', tier: 'build', default: true, group: 'Feel' },
    num('eyeHeight', 'Eye height', 'First person only: how high the eyes are above the subject.', 0.9, 'build', { min: 0, max: 5, step: 0.05, unit: 'm', group: 'Position' }),
  ],
  slots: [] as readonly ChildSlot[],
});

export const veilSchema = defineSchema({
  kind: 'veil',
  version: 1,
  label: 'Focus veil',
  doc: 'What happens to the world around the thing you are editing: it whites out and blurs so you can look at the one thing, and whatever is in the way is hidden so you can orbit or fly round it. Switch it off or change it like any preset.',
  icon: 'eye',
  variables: [
    { key: 'style', type: 'enum', label: 'Around it', doc: 'white = fades to white, blur = blurs the edges, both, or off to keep the whole world visible.', tier: 'play', default: 'both', options: ['white', 'blur', 'both', 'off'], group: 'Veil' },
    num('falloff', 'White-out distance', 'How many metres behind the thing the world takes to fade to white. Small = a sharp spotlight.', 14, 'play', { min: 2, max: 300, step: 1, unit: 'm', group: 'Veil' }),
    num('blur', 'Blur', 'How blurry the edges of the screen get.', 6, 'play', { min: 0, max: 24, step: 1, unit: 'px', group: 'Veil' }),
    { key: 'hideNear', type: 'boolean', label: 'Hide what is in the way', doc: 'Slice away anything between the camera and the thing, so you can see it from every side.', tier: 'play', default: true, group: 'Veil' },
    num('margin', 'Room around it', 'Multiplies the size of the clear area around the thing.', 1, 'build', { min: 0.5, max: 4, step: 0.05, group: 'Veil' }),
    { key: 'mode', type: 'enum', label: 'Camera', doc: 'orbit circles the thing; fly lets you move with W A S D and Q E.', tier: 'play', default: 'orbit', options: ['orbit', 'fly'], group: 'Camera' },
    num('flySpeed', 'Fly speed', 'Metres per second in fly mode (hold Shift for 3x).', 8, 'build', { min: 1, max: 80, step: 1, unit: 'm/s', group: 'Camera' }),
  ],
  slots: [] as readonly ChildSlot[],
});

export const modelSchema = defineSchema({
  kind: 'model',
  version: 1,
  label: 'Model',
  doc: 'A voxel model: a 3D grid of coloured blocks with a palette (colour, roughness, glow, see-through). Sculpt it with the voxel brushes; the PBR skin on top is a preset too.',
  icon: 'cube',
  variables: [
    { key: 'data', type: 'string', label: 'Voxel data', doc: 'The encoded grid and palette (edited with the sculpt tools, not by hand).', tier: 'pro', default: '', group: 'Model' },
    num('scale', 'Block size', 'Metres per block. A goblin is about 0.1 per block, a palm 0.25.', 0.1, 'play', { min: 0.01, max: 5, step: 0.01, unit: 'm', group: 'Model' }),
    num('x', 'X', 'Position left/right.', 0, 'build', { step: 0.1, unit: 'm', group: 'Place' }),
    num('y', 'Y', 'Position up/down (0 = on the ground).', 0, 'build', { step: 0.1, unit: 'm', group: 'Place' }),
    num('z', 'Z', 'Position forward/back.', 0, 'build', { step: 0.1, unit: 'm', group: 'Place' }),
    num('yaw', 'Turn', 'Which way it faces, in degrees.', 0, 'play', { min: -180, max: 180, step: 1, unit: 'deg', group: 'Place' }),
    { key: 'ao', type: 'boolean', label: 'Soft shading', doc: 'Darken the creases between blocks.', tier: 'play', default: true, group: 'Look' },
    { key: 'greedy', type: 'boolean', label: 'Merge flat faces', doc: 'Fewer triangles for flat areas. Turn off to see every block edge.', tier: 'pro', default: true, group: 'Look' },
    { key: 'castShadow', type: 'boolean', label: 'Casts shadow', doc: 'Whether it throws a shadow.', tier: 'build', default: true, group: 'Look' },
    { key: 'skin', type: 'ref', label: 'Skin', doc: 'An optional PBR skin preset drawn over the blocks.', tier: 'build', default: null, refKinds: ['material'], group: 'Look' },
  ],
  slots: [] as readonly ChildSlot[],
});

export const raceSchema = defineSchema({
  kind: 'race',
  version: 1,
  label: 'Race rules',
  doc: 'The rules of a race on this map. Every number is a variable: fork it, tweak it, or let a driver move it.',
  icon: 'flag',
  variables: [
    num('laps', 'Laps', 'How many times round the circuit.', 3, 'play', { min: 1, max: 20, step: 1, group: 'Race' }),
    num('field', 'Racers', 'How many goblins start (you plus the AI).', 8, 'play', { min: 2, max: 12, step: 1, group: 'Race' }),
    num('aiSkill', 'AI skill', '0.5 = sloppy rivals, 1 = as designed, 1.4 = ruthless.', 1, 'play', { min: 0.3, max: 1.5, step: 0.05, group: 'Race' }),
    num('itemsPerLap', 'Items per lap', 'How often racers get an item (a new one every 1/N of a lap). 0 = no items.', 4, 'build', { min: 0, max: 12, step: 1, group: 'Items' }),
    num('boostPads', 'Boost pads', 'Glowing pads on the road that give a speed burst.', 3, 'build', { min: 0, max: 8, step: 1, group: 'Road' }),
    num('boostPadMs', 'Pad boost time', 'How long a boost pad boosts you.', 1400, 'build', { min: 200, max: 5000, step: 100, unit: 'ms', group: 'Road' }),
    { key: 'rumble', type: 'boolean', label: 'Rumble strips', doc: 'Red and white strips on the corners.', tier: 'build', default: true, group: 'Road' },
    { key: 'startLine', type: 'boolean', label: 'Start line', doc: 'The checkered start and finish line.', tier: 'build', default: true, group: 'Road' },
    { key: 'walls', type: 'boolean', label: 'Walls', doc: 'Low walls along both sides keep everyone on the island.', tier: 'build', default: true, group: 'Road' },
  ],
  slots: [] as readonly ChildSlot[],
});

export const soundSchema = defineSchema({
  kind: 'sound',
  version: 1,
  label: 'Sound effect',
  doc: 'A synthesized sound: layers of tones and noise with an envelope. Edit it in the Sound Lab, randomize it, or let a driver move its volume and pitch.',
  icon: 'sound',
  variables: [
    { key: 'slot', type: 'string', label: 'Plays as', doc: 'Which game event uses this sound (e.g. boost, lap, ui-click).', tier: 'build', default: '' },
    num('volume', 'Volume', '0 = silent, 1 = as designed.', 1, 'play', { min: 0, max: 2, step: 0.01 }),
    num('pitch', 'Pitch', 'Multiplier on every note: 0.5 = an octave down, 2 = an octave up.', 1, 'play', { min: 0.25, max: 4, step: 0.01 }),
    { key: 'enabled', type: 'boolean', label: 'Enabled', doc: 'Mute just this sound.', tier: 'play', default: true },
    { key: 'recipe', type: 'string', label: 'Recipe', doc: 'The layers that make the sound (edited in the Sound Lab).', tier: 'pro', default: '' },
  ],
  slots: [] as readonly ChildSlot[],
});

export const engineSoundSchema = defineSchema({
  kind: 'engine-sound',
  version: 1,
  label: 'Engine hum',
  doc: 'How the rolling ball hums: pitch, loudness and brightness follow speed and throttle.',
  icon: 'engine',
  variables: [
    num('volume', 'Volume', '0 = silent, 1 = as designed.', 1, 'play', { min: 0, max: 2, step: 0.01 }),
    num('baseFreq', 'Idle pitch', 'Pitch when standing still (Hz).', 70, 'play', { min: 20, max: 400, step: 1, unit: 'Hz', group: 'Pitch' }),
    num('freqPerSpeed', 'Pitch rise with speed', 'How much the pitch climbs at top speed (Hz).', 190, 'play', { min: 0, max: 800, step: 1, unit: 'Hz', group: 'Pitch' }),
    num('freqPerThrottle', 'Pitch rise with throttle', 'Extra pitch while accelerating (Hz).', 30, 'build', { min: 0, max: 300, step: 1, unit: 'Hz', group: 'Pitch' }),
    num('baseGain', 'Idle loudness', 'Loudness when standing still.', 0.05, 'build', { min: 0, max: 0.3, step: 0.005, group: 'Loudness' }),
    num('gainPerThrottle', 'Loudness with throttle', 'Extra loudness while accelerating.', 0.1, 'build', { min: 0, max: 0.3, step: 0.005, group: 'Loudness' }),
    num('gainPerSpeed', 'Loudness with speed', 'Extra loudness at top speed.', 0.05, 'build', { min: 0, max: 0.3, step: 0.005, group: 'Loudness' }),
    num('baseFilter', 'Idle brightness', 'How bright the hum is when standing still (Hz).', 400, 'build', { min: 100, max: 4000, step: 10, unit: 'Hz', group: 'Tone' }),
    num('filterPerSpeed', 'Brightness with speed', 'How much brighter at top speed (Hz).', 2600, 'build', { min: 0, max: 8000, step: 10, unit: 'Hz', group: 'Tone' }),
    num('filterPerThrottle', 'Brightness with throttle', 'Extra brightness while accelerating (Hz).', 600, 'pro', { min: 0, max: 4000, step: 10, unit: 'Hz', group: 'Tone' }),
    num('baseNoise', 'Idle rumble', 'Airy noise when standing still.', 0.01, 'build', { min: 0, max: 0.2, step: 0.005, group: 'Noise' }),
    num('noisePerSpeed', 'Rumble with speed', 'Extra noise at top speed.', 0.06, 'build', { min: 0, max: 0.3, step: 0.005, group: 'Noise' }),
  ],
  slots: [] as readonly ChildSlot[],
});

export const musicSchema = defineSchema({
  kind: 'music',
  version: 1,
  label: 'Music',
  doc: 'A generated loop: pick a mood and tempo, change the seed for a different tune.',
  icon: 'music',
  variables: [
    num('volume', 'Volume', '0 = silent, 1 = as designed.', 1, 'play', { min: 0, max: 2, step: 0.01 }),
    { key: 'mood', type: 'enum', label: 'Mood', doc: 'The feel of the tune.', tier: 'play', default: 'energetic', options: ['chill', 'energetic', 'dramatic'] },
    num('bpm', 'Tempo', 'Beats per minute.', 138, 'play', { min: 60, max: 200, step: 1, unit: 'BPM' }),
    num('bars', 'Length', 'Bars before it loops.', 8, 'build', { min: 1, max: 16, step: 1 }),
    num('seed', 'Seed', 'A different number is a different tune.', 7, 'play', { min: 0, max: 99999, step: 1 }),
    { key: 'enabled', type: 'boolean', label: 'Enabled', doc: 'Switch the music off.', tier: 'play', default: true },
  ],
  slots: [] as readonly ChildSlot[],
});

export const CORE_SCHEMAS = [materialSchema, entitySchema, sceneSchema, cameraSchema, mechanicSchema, terrainSchema, trackSchema, decorSchema, modulatorSchema, raceSchema, itemSchema, modelSchema, cameraRigSchema, veilSchema, interfaceSchema, soundSchema, engineSoundSchema, musicSchema] as const;

export function registerCoreSchemas(registry: SchemaRegistry): void {
  for (const schema of CORE_SCHEMAS) if (!registry.get(schema.kind)) registry.register(schema);
}
