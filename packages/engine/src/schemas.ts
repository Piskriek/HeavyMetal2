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

export const CORE_SCHEMAS = [materialSchema, entitySchema, sceneSchema, cameraSchema, mechanicSchema, terrainSchema, trackSchema, decorSchema, modulatorSchema] as const;

export function registerCoreSchemas(registry: SchemaRegistry): void {
  for (const schema of CORE_SCHEMAS) if (!registry.get(schema.kind)) registry.register(schema);
}
