# Prompt for the Arena AIs: Warcraft-style PBR textures, made from math

Copy everything below the line into the Arena chat as one message. It is self-contained: no files, links or secrets.

---

You are making the ground textures for a stylised 3D island game (voxel avatars, goblins racing in glass balls, players building their own islands). The look we want is **Warcraft-style hand-painted**, the way World of Warcraft's ground reads: bold, chunky shapes you can read from 20 metres away; light and shadow painted into the colour (a lighter top-left edge on each pebble or clump, a darker underside); warm, saturated but not neon colours; soft painted gradients instead of photographic noise; nothing that looks like a photo.

Every texture is a **small graph of math nodes**, not an image. The game evaluates the graph on the player's computer at load time, so the textures cost nothing to download and can be changed like any other setting. You write the graphs as JSON in the exact format below.

## What to make

Two sets, one graph per surface, for these 26 surfaces:

grass, sand, wet-sand, rock, moss, soil, lava, basalt, dunes, mud, scree, pumice, coral, ochre-strata, cliff, shallows, tarmac, wet-tarmac, start-line, boost-pad, kerb, dirt-road, boardwalk, cobbles, dusty-road, basalt-columns

**Set A, the painted ground.** Ids exactly as listed (`grass`, `sand` ...). Each tile covers about 3 by 3 metres of ground and is evaluated at 256 by 256 pixels. Detail at the scale of pebbles, grass clumps, cracks and planks.

**Set B, the voxel blocks.** Ids `voxel-grass`, `voxel-sand` ... One tile is the face of one half-metre block, evaluated at 32 by 32 pixels (often seen at 16). It must read like pixel art: big flat areas, 4 to 6 tones per surface, crisp shapes, a slightly lighter rim and darker inner corner painted in so a block looks bevelled; its height map gives the block face a gentle bevel and a few chunky bumps, not fine noise.

## Hard rules

1. **No seams.** Every tile repeats edge to edge with no visible join. In this format that is automatic **only if every `scale`, `count`, `countX` and `countY` is a whole number** (noise and cells then repeat exactly at the tile edge). Never use fractional values for those. Keep `warp.amount` at 0.15 or less so warped shapes stay continuous.
2. **No repeats.** Nobody may spot the tile repeating across a field. So: no single landmark feature (one big crack, one bright stone, one dark patch) inside a tile; detail spread evenly; the big variation should come from 2 or more noise layers at different whole-number scales mixed together. For every surface also give **three variants**: the same graph with different `seed` values on the nodes, ids `<id>-a`, `<id>-b`, `<id>-c` (the game mixes them across the ground).
3. **Only the node types below**, with exactly the fields shown. Every node has a unique `id`. No cycles.
4. **Outputs**: `albedo` must point at a colour node (a `ramp`, a colour `constant`, or a `blend` / `warp` / `invert` / `scaleBias` of colour nodes). `height` and `roughness` must point at scalar nodes. Do not output a normal map: the game makes it from the height.
5. **At most 24 nodes per graph** (it runs on the player's computer).
6. **Values**: colours are 0 to 1 per channel (linear, not 0 to 255). Height is 0 to 1, with 0.4 to 0.6 as the "flat" middle; keep the height range to about 0.3 wide so the bumps stay moderate. Roughness 0 to 1: wet and polished things low (wet sand 0.25 to 0.4, wet tarmac 0.2 to 0.35, lava crust 0.5 with glowing cracks 0.3), dry ground high (sand, soil, grass 0.75 to 0.95).

## The format

```json
{
  "id": "basalt",
  "name": "Basalt",
  "nodes": [
    { "id": "cells", "type": "cellular", "scale": 2, "jitter": 0.8, "mode": "edge", "seed": 17 },
    { "id": "warpField", "type": "noise", "scale": 2, "octaves": 2, "gain": 0.5, "seed": 31 },
    { "id": "warpedCells", "type": "warp", "in": "cells", "warp": "warpField", "amount": 0.08 },
    { "id": "cracks", "type": "levels", "in": "warpedCells", "inLow": 0.03, "inHigh": 0.5, "gamma": 0.8, "outLow": 0, "outHigh": 1 },
    { "id": "rock", "type": "ramp", "in": "cracks", "stops": [ { "at": 0, "r": 0.045, "g": 0.06, "b": 0.075 }, { "at": 0.4, "r": 0.058, "g": 0.073, "b": 0.088 }, { "at": 1, "r": 0.085, "g": 0.1, "b": 0.115 } ] },
    { "id": "height", "type": "scaleBias", "in": "cracks", "scale": 0.14, "bias": 0.42 },
    { "id": "roughness", "type": "scaleBias", "in": "cracks", "scale": 0.14, "bias": 0.78 }
  ],
  "out": { "albedo": "rock", "height": "height", "roughness": "roughness" }
}
```

(That is a plain, dark basalt from our current set: correct format, but too flat and photographic for the look we want. Do better.)

### Node types (all coordinates are the tile's u, v from 0 to 1; everything wraps at the edges)

| type | fields | gives | what it does |
|---|---|---|---|
| `noise` | `scale` (whole number, 1 to 32), `octaves` (1 to 6), `gain` (0 to 1), `seed` | scalar 0..1 | smooth value noise; `scale` is how many bumps fit across the tile; each octave doubles the frequency and multiplies the strength by `gain` |
| `cellular` | `scale` (whole number, 1 to 32), `jitter` (0 to 1), `mode` (`"f1"`, `"f2"` or `"edge"`), `seed` | scalar 0..1 | cells (Voronoi): `f1` distance to the nearest point (round blobs), `f2` to the second nearest, `edge` dark lines between cells (cracks, cobbles, plates) |
| `grain` | `seed` | scalar 0..1 | a random value per pixel (fine speckle) |
| `stripes` | `count` (whole number), `softness` (0 hard to 1 sine), `vertical` (true or false, required) | scalar | parallel bands (planks, ripples, strata) |
| `checker` | `countX`, `countY` (whole numbers) | scalar 0 or 1 | a checkerboard (start line, kerbs) |
| `constant` | `value`: a number, or `[r, g, b]` | scalar or colour | a fixed value |
| `warp` | `in` (node id), `warp` (scalar node id), `amount` (0 to 0.15) | same type as `in` | pushes `in` sideways by the warp field: wavy cracks, organic edges |
| `blend` | `a`, `b` (node ids of the same type), `amount` (0 to 1), `mode` (`"mix"`, `"add"`, `"multiply"`, `"min"`, `"max"` or `"overlay"`), optional `mask` (scalar node id) | type of `a` | combines two nodes; `amount` times the mask is how much of `b` |
| `levels` | `in` (scalar), `inLow`, `inHigh`, `gamma`, `outLow`, `outHigh` | scalar | remaps a range: contrast, thresholds, painted hard edges (`inLow` and `inHigh` close together) |
| `invert` | `in` | same type | 1 minus the value |
| `ramp` | `in` (scalar), `stops`: a list of `{ "at": 0..1, "r", "g", "b" }`, in rising `at` order | colour | a colour gradient picked by the scalar: this is where the painted palette lives |
| `scaleBias` | `in`, `scale`, `bias` | same type | value times `scale` plus `bias` |

### Tricks that give the hand-painted look in this format

- **Posterise** for the painted, chunky feel: run a scalar through `levels` with a high gamma or narrow in-range, or give a `ramp` stops close together so colours step instead of fading.
- **Painted lighting**: blend a `cellular` `f1` (round shapes) with a noise offset of itself to get a lighter top and darker bottom per pebble or clump; or add a light rim with `levels` on `edge`.
- **Tone variety without repeats**: mix two `noise` layers at different whole-number scales (for example 3 and 7) with `blend`, then send that through the `ramp`.
- **Roughness from the same shapes** as the colour (cracks rougher, tops smoother), so shine sits on the forms you see.

## Art notes per surface (what each should feel like)

- **grass**: dense painted clumps, a lighter yellow-green on the tops, deep green in the gaps, no individual photo blades.
- **sand**: warm cream with soft wind ripples and a few darker speckles. **wet-sand**: darker, cooler, shinier (low roughness). **dunes**: bigger, smoother ripples, warmer.
- **rock**: chunky plates with painted light edges and dark cracks, grey-blue. **cliff**: taller, vertical strata, darker. **basalt**: near-black, hexagonal-ish cells. **basalt-columns**: clear hexagonal column tops.
- **moss**: soft rounded green cushions. **soil**: brown clods with a few pebbles. **mud**: dark, smooth, shiny puddle patches.
- **lava**: dark crust plates with bright orange-yellow cracks (cracks low roughness, crust higher).
- **scree**: loose angular grey stones of mixed sizes. **pumice**: pale porous grey with small round holes. **ochre-strata**: horizontal bands of ochre, rust and cream.
- **coral**: pink-orange rounded nubs, a few bright highlights. **shallows**: pale sand seen through water, cool tint, low roughness.
- **tarmac**: dark grey with fine aggregate speckle. **wet-tarmac**: darker and glossy. **dirt-road**: packed brown with tyre-worn smoother middle. **dusty-road**: paler, drier dirt.
- **start-line**: crisp black and white checker (painted, slightly worn). **kerb**: red and white stripes. **boost-pad**: bright teal-blue with chevron-like stripes (glowing look in the albedo).
- **boardwalk**: warm planks with dark gaps and painted wood grain. **cobbles**: rounded stones with mortar lines, each stone lit from the top-left.

For the **voxel set**, the same feel at 32 by 32: fewer, bigger shapes, 4 to 6 tones, a painted bevel on every block face (lighter rim top-left, darker bottom-right) and a gentle bevel in the height map.

## What to send back

1. A JSON array with all **Set A** graphs and their variants (26 surfaces × 3 variants = 78 graphs; ids `grass-a`, `grass-b`, `grass-c` ...).
2. A JSON array with all **Set B** voxel graphs and their variants (78 graphs; ids `voxel-grass-a` ...).
3. One line per surface on what you were going for.

Double-check before you answer: every `scale`/`count` is a whole number; every referenced id exists; `albedo` points at a colour node and `height`/`roughness` at scalar nodes; at most 24 nodes per graph; no cycles. Invalid graphs are thrown away.
