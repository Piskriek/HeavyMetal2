# The hotbar: how everything is edited

The owner (2026-10-03): the hotbar is how you edit everything. It arrives with the tour and stays; it has Easy / Pro / Studio built in; Select can select anything and change it; each tab holds **ways of working** (tools), not the materials (those go in a **palette**, a film strip at the top middle); picking a tool shows **its presets, previewed on what you selected**; heavy preset trees sit behind **More…** in Studio. "Everything is a preset, even the hotbar." This file is the design; `MASTER_PLAN.md` section 6.3 is the order of work; the screen map's hotbar audit measures the gaps.

Research behind the tool lists (2026-10-03): the brushes artists use most in ZBrush and Blender ([LinkedIn Learning, most used ZBrush brushes](https://www.linkedin.com/learning/zbrush-2020-essential-training/the-most-commonly-used-brushes), [Cody Burleson, 7 quintessential ZBrush brushes](https://codyburleson.com/blog/7-quintessential-brushes-for-zbrush-beginners), [Blender manual, sculpt brushes](https://docs.blender.org/manual/en/latest/sculpt_paint/sculpting/brushes/brushes.html)), terrain tools ([Unity Terrain Tools: sculpt](https://docs.unity3d.com/Packages/com.unity.terrain-tools@5.1/manual/sculpt.html)), painting tools ([Photoshop toolbox](https://www.elated.com/photoshop-toolbox/), [clone and healing](https://petapixel.com/photoshop-healing-tools/)) and viewport navigation ([Unity scene view](https://docs.unity3d.com/Manual/SceneViewNavigation.html), [Unreal viewport controls](https://dev.epicgames.com/documentation/unreal-engine/viewport-controls-in-unreal-engine), [Blender navigation](https://docs.blender.org/manual/en/2.93/editors/preferences/navigation.html)). Where they agree, the tool is in Easy; the rest are one + away.

---

## 1. The loop: five things, each a preset

When you edit, five things are on screen, and every one of them is a preset made of presets:

| What | Where | What it holds | Example (Paint) |
|---|---|---|---|
| **Selection** | in the world, outlined | what you work on: a thing, a part of it, an area of ground, a texture, the sky | the patch of beach you are looking at |
| **Hotbar** | bottom, always there after the tour | 9 ways of working for the open tab (tools) | Brush, Spray, Fill, Gradient, Stamp, Pattern, Clone, Smudge, Eraser |
| **Tool presets** | a row just above the hotbar, when a tool is picked | that tool's own presets, each **previewed on your selection** | Brush: soft, hard, noisy edge, square, splatter (each shown painting your beach) |
| **Palette** | a film strip, top middle, scroll buttons both ends | what the tool applies: yours first, then the community's | sand, wet sand, coral, tarmac … and the community's textures |
| **Inspector** | a window (Pro, Studio) | every variable of the selection or the tool; **More…** opens the deeper presets (Studio) | brush size, strength, falloff; More…: pressure curve, jitter, script |

The loop: select something, pick a way of working, pick one of its presets (you see what it would do), pick what to apply from the palette, use it. Every one of those is a preset you can open, change, save as your own and share; the hotbar itself is one too.

## 2. Three levels, on the hotbar itself

The end of the hotbar has three buttons: **Easy / Pro / Studio** (the level is part of the hotbar preset; it remembers per player).

| | Easy | Pro | Studio |
|---|---|---|---|
| Hotbar | 9 ready-made tools per tab | + toggles beside it (symmetry, detail, smoothing), **+** to add a tool | everything, every tool |
| Tool presets row | the 4 best, big previews | all of them | all, plus "save this as a preset" |
| Palette | ready-made | + community | + your own imports, every variable |
| Inspector | hidden | the first level of variables | everything, **More…** trees (physics, scripts, AI), timelines |
| Camera | walk | walk, fly | studio camera, windows |

Easy is the 6-year-old, Studio the 20-year-old (owner's rule, section 1 of STATUS). The island's Walk / Studio switch and the track editor's Easy / Build / Pro collapse into this one control.

## 3. The tabs and their tools

### F1 Select: select anything, change it

What Select picks follows what you point at, and gets finer each click (Esc goes back up):

| You point at | First click | Again (Pro) | Again (Studio) |
|---|---|---|---|
| a thing (a palm, a barrel, a ball racer) | the thing | one of its parts | its voxels (faces, rows and corners of the blocks; vertices and edges once things have smooth meshes) |
| the ground | an area (circle, box or lasso) | everything painted with that surface (a "magic wand") | single cells |
| a plant | that plant | every plant of that kind | the plant rules (how it grows, follows the ground) |
| water, sky, light | the island's sea, sky, light presets | | |
| the track | the track | a stretch of it | one point |

Tools: **Select** (presets: click, box, lasso, wand, everything of a kind), **Move**, **Turn**, **Size**, **Copy**, **Delete**, **Focus**, **Hide others**, **Look at**.

**Move** with something selected moves it; its presets are ways to move a thing:
Drag over the ground (it follows the surface), Gizmo arrows (one direction at a time), Free in the air, Snap to a grid, Nudge with the arrow keys, Carry it (pick it up, walk, put it down), Line it up with the ground's slope.

**Move** with nothing selected moves you; its presets are the ways people move round a 3D world on a computer (the same set as the Camera tab):

| Way | How it feels | Where it comes from |
|---|---|---|
| Walk | W A S D and the mouse, first person or over the shoulder | games |
| Fly | free in the air: W A S D, Q / E up and down, hold the right button to look | Unity flythrough, Unreal |
| Orbit | turn round a point: turntable keeps the horizon level, trackball any angle | Blender, Maya, Unity Alt-drag |
| Pan | slide sideways and up/down without turning | every 3D tool |
| Zoom | the wheel moves towards the cursor | Blender "zoom to mouse" |
| Map | from above: drag to pan, wheel to zoom | maps, strategy games |
| Focus | F flies to the selection and orbits it | Unity, Unreal, Blender |
| Follow | the camera stays with a thing (a racer, your avatar) | games, spectating |
| Jump to | click a spot or a saved view to go there | maps, bookmarks |

### F2 Paint: ways to paint (the textures are in the palette)

Easy hotbar: **Brush**, **Spray** (clusters of dabs), **Fill** (a whole connected patch of one surface), **Gradient** (blend two surfaces across a distance), **Stamp** (press a shape), **Pattern** (a repeating pattern), **Clone** (copy ground from one place to another), **Smudge** (mix the edges between surfaces), **Eraser** (back to what the world rules say grows there).
One + away: Line (paint along a line, roads and paths), Heal (blend a patch to match around it), Paint by slope (only steep or only flat ground), Paint by height.
Palette: every surface (the 26 today) and colours; the community's textures next.
Toggles (Pro): size, strength, edge softness, symmetry (mirror round a point or a line).
On a selected thing, Paint paints its blocks with colours; the palette shows that thing's colours and the community's palettes.

### F3 Sculpt: ways to sculpt

Easy hotbar: **Raise** (draw), **Lower**, **Smooth**, **Flatten**, **Grab** (pull a piece along), **Clay** (build up in layers), **Crease** (sharp ridges and cuts), **Stamp** (press a shape from the palette), **Terrace** (steps).
One + away: Inflate, Pinch, Twist, Smudge, Noise (roughen), Erode (water, wind, settling), Bridge (land between two points), Clone, Slope flatten, Polish, Snake hook and Layer (things), Trim.
Palette: shapes to stamp (crater, mound, plateau, ridge, dune, volcano, cliff) and patterns (rocks, cracks, ripples, scales), yours and the community's.
Toggles (Pro, beside the hotbar): **Symmetry** (left/right, front/back, round n times), **More detail** (finer ground cells, more blocks in a thing), **Less detail**, **Smoothing** (steady the stroke, smooth after each one), **Only low / only steep** (mask by cavity or slope).
Works on the ground and on things (blocks added, removed, smoothed).

### The other tabs

| Tab | Ways of working (hotbar) | Palette |
|---|---|---|
| F4 Animate | Play, Pose (bend a part), Keys (a timeline), Loop, Blend two, Speed | moves (yours, the community's) |
| F5 Sound | Play, Attach (a sound on a thing or an event), Shape (its layers), Zone (a place that sounds) | sounds |
| F6 Lights | Pick a look, Sun and time (drag the sun), Place a light, Haze, Picture effects, Day and night | lighting looks |
| F7 Activities | Play, Host, Make one | activities |
| F8 Avatar | avatar mode (done): your characters, looks, colours, wears, moves | avatars, parts |
| F9 Things | Place one, Scatter (a brush of many), Row (a line of them), Swap (replace one thing with another) | things |
| F10 Camera | the ways to move (above), shots (follow, fixed, cinematic), Picture (screenshot) | camera presets |

## 4. More… (deep presets stay out of the way)

Every preset is built from other presets; the Inspector shows the first level. Heavy children sit behind **More…**, shown in Studio: a Goblin Racing ball shows Look and Size; More… opens Physics (mass, bounce, friction, damping), Controls, Brain (AI), Sounds, Sprites. A tool shows size and strength; More… opens its pressure curve, jitter, the sprite and sound it plays, its script.

## 5. The hotbar is a preset

Kind `hotbar`: per tab, its 9 slots; its level (Easy / Pro / Studio); how it behaves (number keys, the wheel cycles, stays or hides while you walk, its size); the toggles shown in Pro. **Settings, Hotbar** manages it: add, remove and reorder tools per tab, go back to the ready-made one, share yours. The tour introduces it (step "Your hotbar") and from then on it stays.

## 6. Layout, from the player's seat

```
             [ ◀  palette: what the tool applies (film strip)  ▶ ]                 [ Walk Studio | 3rd 1st | Flat PBR ]

                                   (the world, your selection outlined)

             [ the picked tool's presets, each previewed on your selection ]
   [ F1 Select | F2 Paint | F3 Sculpt | … | F10 Camera ]
   [ 1 2 3 4 5 6 7 8 9 | + | Symmetry Detail Smooth (Pro) | Easy Pro Studio ]
```

One loud thing at a time: the palette and the tool-presets row only show while a tool that uses them is picked; Easy hides the toggles and the Inspector.

## 7. The audit: what the hotbar cannot edit yet

`scripts/ui-map.mjs` writes a **hotbar coverage** table into the screen map: every kind of thing in the world (ground height, ground surface, a thing, a thing's part, its blocks, plants, water, sky and light, sounds, the track, race rules, ball physics, the avatar) against Select and each tab: can it be selected, which tool changes it, at which level. Missing cells are red. Today's gaps (first audit, 2026-10-03): Select only picks placed things (not the ground, surfaces, plants, water, sky, parts or blocks); Paint holds textures instead of ways to paint; Sculpt mixes ways and shapes and has no toggles; nothing edits a thing's blocks on the island; no palette; no tool presets row; no levels on the hotbar; Move has no ways to move and does not move you; the camera ways are only first and third person.
