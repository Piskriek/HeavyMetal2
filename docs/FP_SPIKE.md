# M01 · T0 — FP eye-level audit

Generated 2026-09-24T07:01:25.562Z from `scripts/eye-level-audit.mjs --course ridge --spacing 200`.

This file is produced by the audit. The **Decision** section at the bottom is the human's
and is preserved verbatim when the audit is re-run.

## What the audit can see

| Measured | Value |
| --- | --- |
| Eye path samples | 787 every 200 spline units |
| Eye pose | ribbon + 62 (ball centre) + 24 along frame up, 6 forward |
| Vertical FOV / aspect | 74° / 1.778 |
| Props inspected | 535 (299 fixed planes, 91 camera-facing, 141 decals, 4 meshes) |
| Fixed planes seen edge-on within 3000 | 200 |
| Road-edge distance ahead | worst 271, median 331 world units |
| Decals/landmarks under 400 | 79 |

## Per stage

`edge distance` is how far ahead the eye can see past the drivable edge — smaller means the
road runs out sooner in the frame, and whatever is behind the edge (terrain, void, sky) shows.

| Stage | Samples | Min edge distance | Thin billboards | Decals near |
| --- | --- | --- | --- | --- |
| alpine | 187 |     272 | 151 | 65 |
| canyon | 31 |     271 | 16 | 10 |
| zigzag | 221 |     279 | 33 | 4 |
| cavern | 43 |     331 | 0 | 0 |
| mine | 245 |     331 | 0 | 0 |
| breakthrough | 33 |     331 | 0 | 0 |
| stadium | 27 |     345 | 0 | 0 |

## Most exposed sample per stage

| Stage | s | Drivable half-width | Edge distance |
| --- | --- | --- | --- |
| canyon | 38500 | 363 | 271 |
| alpine | 38300 | 365 | 272 |
| zigzag | 44700 | 373 | 279 |
| cavern | 88900 | 443 | 331 |
| mine | 97500 | 443 | 331 |
| breakthrough | 146500 | 443 | 331 |
| stadium | 153100 | 462 | 345 |

## Fixed planes seen edge-on (worst first)

| Prop | Source | min \|n·v\| | s | Distance |
| --- | --- | --- | --- | --- |
| Grandstand Roar | builder | 0.000 | 21700 | 2736 |
| Green Pasture | builder | 0.000 | 10100 | 1156 |
| Archway Stone Pillar | builder | 0.001 | 20300 | 618 |
| Pine Forest Wall | builder | 0.001 | 19700 | 2473 |
| Archway Stone Pillar | builder | 0.001 | 24300 | 2765 |
| Archway Stone Pillar | builder | 0.001 | 22100 | 2241 |
| Fern Bramble Undergrowth | builder | 0.002 | 44900 | 706 |
| Cavern Wall Curtain Right | builder | 0.002 | 43500 | 2861 |
| Pine Forest Wall | builder | 0.002 | 13900 | 1495 |
| Green Pasture | builder | 0.003 | 48700 | 1447 |
| Pine Forest Wall | builder | 0.003 | 7700 | 2710 |
| Archway Stone Pillar | builder | 0.003 | 24500 | 2345 |
| Goblin Bleacher A | builder | 0.003 | 8100 | 1635 |
| Fern Bramble Undergrowth | builder | 0.003 | 3700 | 2464 |
| Scrap Iron Barricade | builder | 0.004 | 3300 | 1189 |
| Pine Forest Wall | builder | 0.004 | 7900 | 1973 |
| Timber Coaster Loop | builder | 0.004 | 4500 | 2902 |
| Archway Curved Header | builder | 0.005 | 21300 | 1419 |
| Archway Stone Pillar | builder | 0.005 | 19500 | 857 |
| Granite Boulder B | builder | 0.005 | 49500 | 1590 |

## Decals and landmarks under the nose

| Item | s | Distance | Angular size |
| --- | --- | --- | --- |
| Tire Skid Marks | 1700 | 86 | 146.4° |
| Rough Timber Deck Planks | 19700 | 88 | 161.8° |
| Dirt & Grass Rim (Bandaid) | 14100 | 90 | 160.9° |
| Timber Planks (Legacy Skid) | 17100 | 91 | 159.1° |
| Rough Timber Deck Planks | 18100 | 92 | 160.9° |
| Blizzard Cobble & Flagstone | 16500 | 94 | 157.1° |
| Goblin Scrap Steel Plating | 25900 | 94 | 160.7° |
| Dirt & Grass Rim (Bandaid) | 4100 | 96 | 146.2° |
| Dirt & Grass Rim | 38900 | 97 | 152.6° |
| Goblin Scrap Steel Plating | 18900 | 101 | 159.3° |
| Reinforced Iron-Wood Panel | 27300 | 101 | 159.7° |
| Wagon Cart Dirt Ruts (Bandaid) | 2900 | 103 | 154.1° |
| Reinforced Iron-Wood Panel | 24100 | 107 | 157.4° |
| Scrap Steel (Legacy Hazard) | 17500 | 107 | 158.2° |
| Goblin Scrap Steel Plating | 20700 | 108 | 158.9° |
| Rough Timber Deck Planks | 23300 | 108 | 158.3° |
| Rough Timber Deck Planks | 26700 | 109 | 155.8° |
| Dirt & Grass Rim | 41100 | 109 | 159.9° |
| Rough Timber Deck Planks | 21500 | 115 | 157.7° |
| Reinforced Iron-Wood Panel | 22500 | 115 | 157.6° |

## What this audit cannot see

Anything that exists only once the scene graph is built and rasterised:

- Code-built scenery in renderer-3d.ts (rock cones, cliff ribbons, stadium, cavern, mine)
- The alpine heightfield silhouette and the painted skydome
- Painted course textures and the dirt/decal material as seen face-on

Props whose world position could not be projected onto the road (alignment kept the stored
height): prop_1790022489868_iyn4, prop_1790022501603_zo6l, prop_1790022504223_wd61, prop_1790022505268_xq9p, prop_1790022506368_8rgf, prop_1790022507374_jl0x, prop_1790022511825_9x8t, prop_1790022538984_tf48, prop_1790022544058_ocah, prop_1790022547235_n5f8, prop_1790022559654_bvre, prop_1790022565432_fyu8, prop_1790022572515_vapz, prop_1790022572847_ajmx, prop_1790022573313_ykls, prop_1790022575026_lin2, prop_1790057489925_u8l0, prop_1790057507554_djgw, prop_1790057514950_57pg, prop_1790057558662_isq4, prop_1790057561468_o6i7, prop_1790057564391_6hpk, prop_1790057575322_mvtr, prop_1790057592596_5t4t, prop_1790057597799_zi7t, prop_1790057601392_n1e8, prop_1790057609583_k67q, prop_1790057620225_6t5m, prop_1790076401392_qdu1, prop_1790076459549_v6td, prop_1790076471418_v1t4, prop_1790076474984_h1l9, prop_1790076476742_qhkx, prop_1790076541909_d8om, prop_1790076570671_a8jo, prop_1790076624539_wgim, prop_1790076648141_sp32, prop_1790076654557_9qc2, prop_1790076774104_z9g4, prop_1790076774104_zug4, prop_1790076966515_adwk, prop_1790077584440_qwet, prop_1790077969124_x4xp, prop_1790077969178_7iua, prop_1790092559317_irn8, prop_1790096147296_n7nq, prop_1790096253906_y1it, prop_1790096274961_a1dn, prop_1790096278857_8o1d, prop_1790099805670_mb9j, prop_1790099806655_snlh, prop_1790137237454_rico, prop_1790156061131_8og6, prop_1790157042069_au6j, prop_1790157060719_wrzj.

## How to look at it yourself

```
npx vite --config vite.preview.config.ts --host 0.0.0.0 --port 5173
# open the printed URL with ?fp=1 appended, start a Quick Race
```

The flag is read once per renderer, so a reload is enough to switch back and forth.

<!-- decision:start -->
## Decision (human)

- [ ] **Go** — the world holds up at eye level; T3 starts as planned.
- [ ] **Go with dressing** — the frame reads, but listed items need work first (say which).
- [ ] **No-go** — the cockpit needs a different approach (say what is wrong).

_Not yet recorded. The numbers above are the evidence; the preview URL is the verdict._
<!-- decision:end -->
