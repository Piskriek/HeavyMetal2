/**
 * The Meshy models in the builder: every model in public/models/kit/index.json is a placeable prop.
 *
 * A kit prop's type is `kit_<id>`. It loads `<id>.glb` (the full tier), or `<id>.lod.glb` on the
 * Performance setting, fitted so its longest side is `size` world units (times the prop's scale),
 * centred on the placement point and standing on it. Icons are the models' own Meshy renders
 * (public/models/kit/thumbs/<id>.png, 256 px, made by scripts/kit-thumbs.ps1).
 */
import type { PropCategory, PropDefinition } from '../builder/prop-catalog';

export type KitShelf = Extract<PropCategory, 'island_kit' | 'stunts' | 'decoration' | 'foliage_3d' | 'rocks_3d' | 'race'>;

export interface KitModel {
  id: string;
  name: string;
  shelf: KitShelf;
  /** The longest side in world units at scale 1 (the island road is 1080 wide). */
  size: number;
}

export const KIT_MODELS: readonly KitModel[] = [
  // Island kit: roads, bridges, cliffs, caves, walls and landmarks.
  { id: 'road-straight', name: 'Road Straight', shelf: 'island_kit', size: 1400 },
  { id: 'hairpin-turn', name: 'Hairpin Turn', shelf: 'island_kit', size: 2400 },
  { id: 'arch-bridge', name: 'Stone Arch Bridge', shelf: 'island_kit', size: 2400 },
  { id: 'boardwalk-bridge', name: 'Boardwalk Bridge', shelf: 'island_kit', size: 2000 },
  { id: 'beach-shelf', name: 'Beach Shelf', shelf: 'island_kit', size: 2000 },
  { id: 'lagoon-platform', name: 'Lagoon Platform', shelf: 'island_kit', size: 2400 },
  { id: 'cliff-block', name: 'Cliff Block', shelf: 'island_kit', size: 1600 },
  { id: 'basalt-cave', name: 'Basalt Cave', shelf: 'island_kit', size: 2200 },
  { id: 'waterfall-cave', name: 'Waterfall Cave', shelf: 'island_kit', size: 2400 },
  { id: 'stone-wall', name: 'Stone Wall', shelf: 'island_kit', size: 1200 },
  { id: 'railing-wall', name: 'Railing Wall', shelf: 'island_kit', size: 1200 },
  { id: 'iron-crate', name: 'Iron Crate', shelf: 'island_kit', size: 260 },
  { id: 'sea-arch', name: 'Sea Arch', shelf: 'island_kit', size: 5000 },
  { id: 'sea-stack-tall', name: 'Tall Sea Stack', shelf: 'island_kit', size: 4000 },
  // Stunts: ramps, decks, loops you ride, bridges and towers.
  { id: 'jump-ramp', name: 'Jump Ramp', shelf: 'stunts', size: 900 },
  { id: 'stunt-launch-ramp', name: 'Launch Ramp', shelf: 'stunts', size: 1600 },
  { id: 'stunt-cliff-ramp', name: 'Cliff Ramp', shelf: 'stunts', size: 2000 },
  { id: 'stunt-cliff-deck', name: 'Cliff Deck', shelf: 'stunts', size: 2400 },
  { id: 'stunt-landing-deck', name: 'Landing Deck', shelf: 'stunts', size: 2000 },
  { id: 'stunt-half-pipe', name: 'Half Pipe', shelf: 'stunts', size: 2400 },
  { id: 'stunt-corkscrew', name: 'Corkscrew', shelf: 'stunts', size: 3000 },
  { id: 'stunt-loop-ramp', name: 'Loop with Ramp', shelf: 'stunts', size: 2400 },
  { id: 'stunt-double-loop-ramps', name: 'Double Loop with Ramps', shelf: 'stunts', size: 3200 },
  { id: 'stunt-suspension-bridge', name: 'Suspension Bridge', shelf: 'stunts', size: 3200 },
  { id: 'stunt-scaffold-tower', name: 'Scaffold Tower', shelf: 'stunts', size: 2400 },
  { id: 'stunt-waterfall-portal', name: 'Waterfall Portal', shelf: 'stunts', size: 2400 },
  // Decoration: the closed rings (hoops to jump through, on fire, lining a tunnel), not rideable loops.
  { id: 'stunt-giant-loop', name: 'Giant Ring', shelf: 'decoration', size: 2400 },
  { id: 'stunt-double-loop', name: 'Double Ring', shelf: 'decoration', size: 2400 },
  { id: 'stunt-hoop-tunnel', name: 'Hoop Tunnel', shelf: 'decoration', size: 3000 },
  // Race: the start line and the finishes a race can end at (race-marks.ts). Placed on the road's middle.
  { id: 'start-line', name: 'Start Line', shelf: 'race', size: 1500 },
  { id: 'finish-line', name: 'Finish Line', shelf: 'race', size: 1500 },
  // Foliage (text-to-3D, art-src/meshy/foliage-rocks*.tsv).
  { id: 'palm-tall', name: 'Tall Palm', shelf: 'foliage_3d', size: 1800 },
  { id: 'palm-leaning', name: 'Leaning Palm', shelf: 'foliage_3d', size: 1500 },
  { id: 'palm-cluster', name: 'Palm Cluster', shelf: 'foliage_3d', size: 1600 },
  { id: 'bush-leafy', name: 'Tropical Bush', shelf: 'foliage_3d', size: 380 },
  { id: 'fern-clump', name: 'Fern Clump', shelf: 'foliage_3d', size: 320 },
  { id: 'grass-tussock', name: 'Beach Grass', shelf: 'foliage_3d', size: 260 },
  { id: 'dry-shrub', name: 'Dry Shrub', shelf: 'foliage_3d', size: 420 },
  { id: 'agave', name: 'Agave', shelf: 'foliage_3d', size: 300 },
  { id: 'driftwood', name: 'Driftwood', shelf: 'foliage_3d', size: 600 },
  // Rocks.
  { id: 'rock-boulder-rough', name: 'Sandstone Boulder', shelf: 'rocks_3d', size: 520 },
  { id: 'rock-basalt-columns', name: 'Basalt Columns', shelf: 'rocks_3d', size: 700 },
  { id: 'rock-slab', name: 'Sandstone Slab', shelf: 'rocks_3d', size: 700 },
  { id: 'rock-pile', name: 'Rock Pile', shelf: 'rocks_3d', size: 420 },
  { id: 'rock-spire', name: 'Sandstone Spire', shelf: 'rocks_3d', size: 1400 },
  { id: 'sea-rock-mossy', name: 'Mossy Sea Rock', shelf: 'rocks_3d', size: 900 },
];

export const KIT_PREFIX = 'kit_';
export const isKitModelType = (type: string) => type.startsWith(KIT_PREFIX);
export const kitModelFor = (type: string): KitModel | undefined =>
  isKitModelType(type) ? KIT_MODELS.find((m) => m.id === type.slice(KIT_PREFIX.length)) : undefined;

export const kitModelUrl = (id: string, low = false) => `/models/kit/${id}${low ? '.lod' : ''}.glb`;
export const kitThumbUrl = (id: string) => `/models/kit/thumbs/${id}.png`;

/** The shelf entries. defaultWidth/Height only size the shelf card; the model keeps its own shape. */
export const KIT_DEFINITIONS: PropDefinition[] = KIT_MODELS.map((m) => ({
  type: `${KIT_PREFIX}${m.id}`, name: m.name, category: m.shelf, url: kitThumbUrl(m.id),
  defaultWidth: m.size, defaultHeight: m.size,
}));
