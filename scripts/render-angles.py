# Renders one model from four sides into one image, for review from every angle (the owner: "checking and
# rechecking diffrent angles on the model").
#   blender -b --factory-startup -P scripts/render-angles.py -- <out.png> <model.glb> [label]
# Cameras look at the model's centre from the front (+z in glTF), the right, the back and three-quarter above;
# each is framed to the model's size. Workbench render with studio light and the model's own colours.
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
out, src = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.data.objects if o.type == 'MESH']
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
centre = (lo + hi) / 2
radius = max((hi - lo).length / 2, 0.05)

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'TEXTURE'
scene.display.shading.show_cavity = True
scene.render.resolution_x = 480
scene.render.resolution_y = 480
scene.render.film_transparent = False
world = bpy.data.worlds.new('w')
scene.world = world
world.color = (0.2, 0.2, 0.22)

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.lens = 50
dist = radius / math.tan(math.radians(18)) * 1.05

# glTF +z (front) is Blender -y; Blender z is up
views = [('front', (0, -1, 0.15)), ('right', (1, 0, 0.15)), ('back', (0, 1, 0.15)), ('top', (0.7, -0.7, 1.1))]
tiles = []
for name, d in views:
    v = Vector(d).normalized()
    cam.location = centre + v * dist
    direction = centre - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    path = out.replace('.png', f'-{name}.png')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    tiles.append(path)

# stitch the four into one row
imgs = [bpy.data.images.load(p) for p in tiles]
w, h = imgs[0].size
sheet = bpy.data.images.new('sheet', w * 4, h, alpha=False)
pixels = [0.0] * (w * 4 * h * 4)
for i, im in enumerate(imgs):
    px = list(im.pixels)
    for y in range(h):
        row = px[y * w * 4:(y + 1) * w * 4]
        start = (y * w * 4 + i * w) * 4
        pixels[start:start + w * 4] = row
sheet.pixels = pixels
sheet.filepath_raw = out
sheet.file_format = 'PNG'
sheet.save()
import os
for p in tiles:
    os.remove(p)
print('angles ->', out)
