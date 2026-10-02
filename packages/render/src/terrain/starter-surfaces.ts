import { recipe, type SurfaceDef } from './surface-set';

/** The starter island palette: 16 tiles from the art pipeline's base-island library (public/textures/island + island-pbr). */
const S = (id: number, name: string, file: string, repeat: number, roughness: number, fallback: string, h = recipe(1)): SurfaceDef =>
  ({ id, name, url: `textures/island/${file}.webp`, pbrUrl: `textures/island-pbr/${file}.webp`, repeat, roughness, fallback, height: h });

export const SURF = { seabed: 1, sand: 2, wetSand: 3, grass: 4, rock: 5, cliff: 6, basalt: 7, dunes: 8, mud: 9, strata: 10, moss: 11, coral: 12, lava: 13, scree: 14, pumice: 15, soil: 16 } as const;

export const STARTER_SURFACES: readonly SurfaceDef[] = [
  S(SURF.seabed, 'Shallows', 'shallows-shallow-tropical-water-m051', 7, 0.25, '#2a7f8a', recipe(0.3, 0, 0, 0.5)),
  S(SURF.sand, 'Beach sand', 'sand-tropical-beach-sand-m006', 5, 0.9, '#d8c79a'),
  S(SURF.wetSand, 'Wet sand', 'wetsand-wet-compact-sand-m281', 5, 0.5, '#9a8a66', recipe(1, 0.4)),
  S(SURF.grass, 'Tropical grass', 'grass-tropical-grass-ground-m353', 3, 0.85, '#4f8a3a', recipe(0.2, 0, 1, 1.5)),
  S(SURF.rock, 'Coastal rock', 'rock-dry-coastal-rock-m017', 6, 0.8, '#8a8378', recipe(1, 0, 0, 1.3)),
  S(SURF.cliff, 'Basalt cliff', 'cliff-basalt-cliff-m001', 9, 0.85, '#4b4f55', recipe(1, 0, 0, 1.3)),
  S(SURF.basalt, 'Wet basalt', 'rock-wet-coastal-basalt-m005', 6, 0.55, '#3b3f45', recipe(1, 0, 0, 1.4)),
  S(SURF.dunes, 'Rippled sand', 'dunes-rippled-tidal-sand-m282', 8, 0.9, '#cdb98a', recipe(1, 0, 0, 0.8)),
  S(SURF.mud, 'Tidal mud', 'mud-tidal-mud-m283', 5, 0.45, '#5b4a3a', recipe(1, 0, 0, 1.3)),
  S(SURF.strata, 'Ochre strata', 'strata-ochre-layered-cliff-m002', 9, 0.85, '#a8794a', recipe(1, 0, 0, 1.2)),
  S(SURF.moss, 'Moss', 'moss-tropical-moss-carpet-m300', 3, 0.9, '#5d7a34', recipe(0.7, 0, 0.5, 1.2)),
  S(SURF.coral, 'Coral rock', 'coral-coral-limestone-m284', 4, 0.75, '#c9b9a0', recipe(0.3, 1, 0, 1.2)),
  S(SURF.lava, 'Lava crust', 'rock-cooled-lava-crust-m015', 6, 0.7, '#2f2c2c', recipe(1, 0, 0, 1.4)),
  S(SURF.scree, 'Scree', 'rock-loose-mixed-scree-m014', 4, 0.85, '#76716a', recipe(1, 0, 0, 1.3)),
  S(SURF.pumice, 'Pumice gravel', 'rock-pumice-gravel-m289', 4, 0.9, '#9a948a'),
  S(SURF.soil, 'Jungle soil', 'mud-mossy-jungle-soil-m007', 4, 0.8, '#4a3d2a', recipe(1, 0, 0.3, 1.2)),
];
