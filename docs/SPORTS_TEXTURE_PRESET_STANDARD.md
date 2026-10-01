# Global Sports Texture Preset Standard

## Goal

Provide recursively editable, brand-neutral PBR preset families from which creators can build recognizable sports games across regions and platforms. Every family receives:

- full-fidelity PBR;
- mobile low-resolution PBR;
- nostalgic pixel/dithered PBR;
- clean, worn, wet and venue-condition variants where relevant.

Presets describe sports and rule-compatible geometry without copying league, club, athlete, sponsor, broadcast or equipment-manufacturer branding.

## Canonical domain and code

Sports presets use naming domain `SPT` in the canonical texture code:

```text
HM2-TXP-M###-SPT-<MAT>-<FORM>-<CH>-<STYLE>-<TIER>-<LAY>-<COND>-<PAL>-<SAMP>-R##
```

Registered material tokens include `TURF`, `COURT`, `TRACK`, `ICE`, `POOL`, `BALL`, `NET`, `GOAL`, `EQUIP`, `KIT`, `VENUE`, and `MARK`.

## Global sport families

### Field and pitch sports

- association football / soccer, including futsal and beach football;
- rugby union, rugby league and sevens;
- cricket, including grass, clay/dust and synthetic wickets;
- field hockey;
- Gaelic football and hurling;
- Australian rules football;
- lacrosse;
- American and Canadian football as part of the global set, not the default.

### Court and net sports

- tennis on grass, clay, hard court and indoor carpet;
- badminton;
- table tennis;
- squash and padel;
- volleyball, beach volleyball and sitting volleyball;
- basketball, netball and 3x3;
- handball and futsal;
- sepak takraw and other regional net-court variants.

### Ice and target sports

- ice hockey and rink variants;
- curling;
- bowls, pétanque and bocce;
- archery and target-field materials;
- cue-sport cloth, rails and ball materials.

### Athletics, cycling and racing

- running tracks, field-event zones and cross-country surfaces;
- road, track, BMX and mountain cycling;
- motorsport circuit, rally, karting and off-road surfaces;
- skate, scooter and roller-sport parks;
- equestrian arena and course surfaces.

### Aquatic and combat sports

- swimming pools, lane systems, starting blocks and wet decks;
- water polo and aquatic goal/net materials;
- surfing and paddle-sport equipment surfaces;
- boxing, wrestling, judo, taekwondo and mixed-martial-art mat/rope/pad materials;
- gymnastics flooring, apparatus grips and landing mats.

## Required preset categories

Each sport family should draw from modular categories rather than one monolithic texture:

1. playing surface and alternate climate/venue conditions;
2. legal line and zone markings as separate masks;
3. ball, shuttle, puck or equivalent play-object materials;
4. goal, net, post, wicket, hoop or target materials;
5. footwear/contact wear, skid and impact decals;
6. clothing and protective-equipment materials;
7. venue walls, seating, barriers and service floors;
8. wordless rule, route, hazard and officiating symbols;
9. weather, sweat, chalk, clay, mud, ice and water condition layers;
10. accessibility and broadcast-readability variants without branded graphics.

## Recognition and rules

- Field proportions and markings must be parameterized in metres from rule presets, not baked permanently into a surface tile.
- Sport markings remain detachable masks so one venue can switch disciplines.
- Equipment scale, rebound, friction and wear metadata belong to the preset recipe.
- Balls and play objects use geometry for silhouette; texture atlases should not fake spherical form with baked lighting.
- Nets use thick mip-safe alpha or geometry according to target platform.
- Team identity uses indexed palette swaps and abstract symbols, never protected logos.
- Number and player-name systems are runtime typography, not generated texture text.

## Style tiers

### Full fidelity

Material-scale normals, complete roughness, metallic/transmission as needed, physically measured coverage and close-camera wear.

### Mobile

128–256 px allocations, broad line masks, thick net alpha, limited palettes and no subpixel court grit or fabric fibers.

### Nostalgic PBR

Point-sampled pixel clusters, dithered transitions and era-inspired palettes while retaining separate material channels and runtime lighting. Do not bake stadium lights, shadows, reflections or highlights into BaseColor.

## Initial production sequence

1. universal playing surfaces and detachable line masks;
2. global ball/play-object materials;
3. goals, nets, posts and targets;
4. kits, footwear and protective equipment;
5. venue and condition layers;
6. sport-specific expansion packs.
