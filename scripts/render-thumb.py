# Renders GLBs side by side into one review thumbnail, headless in Blender (Workbench: fast, textured, studio lit).
#   blender -b --factory-startup -P scripts/render-thumb.py -- <out.png> <a.glb> [b.glb ...]
# Used by the overnight asset watcher: each asset's low and high levels next to each other, from a three-quarter view.
import math
import os
import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
out, files = os.path.abspath(argv[0]), [os.path.abspath(f) for f in argv[1:]]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

x = 0.0
lo, hi = Vector((1e9, 1e9, 1e9)), Vector((-1e9, -1e9, -1e9))
for f in files:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    shift = Vector((x - mn.x, -(mn.y + mx.y) / 2, 0))
    for o in new:
        if o.parent is None:
            o.location += shift
    lo = Vector((min(lo.x, mn.x + shift.x), min(lo.y, mn.y + shift.y), min(lo.z, mn.z)))
    hi = Vector((max(hi.x, mx.x + shift.x), max(hi.y, mx.y + shift.y), max(hi.z, mx.z)))
    x += (mx.x - mn.x) * 1.35 + 0.1

centre, size = (lo + hi) / 2, (hi - lo)
radius = max(size.x, size.y, size.z) * 0.5 + 1e-3
cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 50
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
d = radius / math.tan(cam_data.angle / 2) * 1.25
direction = Vector((0.3, -1.0, 0.45)).normalized()
cam.location = centre + direction * d
cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

scene.render.engine = 'BLENDER_WORKBENCH'
shading = scene.display.shading
shading.light = 'STUDIO'
shading.color_type = 'TEXTURE'
shading.show_shadows = True
shading.show_cavity = True
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new('w')
scene.render.resolution_x = 768
scene.render.resolution_y = 512
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print(f'thumb -> {out}')
