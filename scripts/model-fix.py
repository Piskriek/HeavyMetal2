# Fixes a normalised model's hidden side, headless in Blender, in place. Image-to-3D sees only the front and invents
# the back: an airlock's back came out a blank panel, a wheel's inner face a flat disc, and some backs carry garbled
# text-like marks (the owner's rule: no lettering). Found by the four-angle review (scripts/render-angles.py).
#   blender -b --factory-startup -P scripts/model-fix.py -- <norm.glb> <op> [<op> ...]
# ops:
#   mirror-z    keep the front half (glTF +z) and mirror it onto the back across the model's middle: for pieces seen
#               from both sides (an airlock or a door in a wall, a wheel whose inner face shows on the other side)
#   plain-back  faces looking backwards (glTF -z) get a plain painted material in the model's own main colour,
#               covering whatever the image model invented there (pieces that stand against a wall)
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
path, ops = argv[0], argv[1:]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Blender is z-up: glTF +z (front) is Blender -y
ys = [(obj.matrix_world @ v.co).y for v in obj.data.vertices]
cy = (min(ys) + max(ys)) / 2

for op in ops:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if op == 'mirror-z':
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        # keep the front half (Blender y <= cy), mirror it across y = cy
        bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=(0, cy, 0), plane_no=(0, 1, 0), clear_outer=True)
        dup = bmesh.ops.duplicate(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:])
        verts = [g for g in dup['geom'] if isinstance(g, bmesh.types.BMVert)]
        m = Matrix.Translation((0, cy, 0)) @ Matrix.Scale(-1, 4, (0, 1, 0)) @ Matrix.Translation((0, -cy, 0))
        bmesh.ops.transform(bm, matrix=m, verts=verts)
        bmesh.ops.reverse_faces(bm, faces=[g for g in dup['geom'] if isinstance(g, bmesh.types.BMFace)])
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
    elif op == 'plain-back':
        src = obj.active_material
        bsdf = next(n for n in src.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        # the model's main colour: the average of its colour map, or the base colour value
        col = list(bsdf.inputs['Base Color'].default_value)
        link = bsdf.inputs['Base Color'].links
        if link and link[0].from_node.type == 'TEX_IMAGE' and link[0].from_node.image:
            img = link[0].from_node.image
            px = img.pixels[:]
            n = len(px) // 4
            step = max(1, n // 4096)
            acc = [0.0, 0.0, 0.0]
            k = 0
            for i in range(0, n, step):
                acc[0] += px[i * 4]; acc[1] += px[i * 4 + 1]; acc[2] += px[i * 4 + 2]; k += 1
            col = [acc[0] / k, acc[1] / k, acc[2] / k, 1.0]
        plain = bpy.data.materials.new('plain-back')
        plain.use_nodes = True
        pb = next(n for n in plain.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        pb.inputs['Base Color'].default_value = col
        for k2 in ('Metallic', 'Roughness'):
            pb.inputs[k2].default_value = bsdf.inputs[k2].default_value
        obj.data.materials.append(plain)
        idx = len(obj.data.materials) - 1
        n_back = 0
        for f in bm.faces:
            if f.normal.y > 0.7:  # Blender +y is glTF -z: facing backwards
                f.material_index = idx
                n_back += 1
        print(f'plain-back: {n_back} faces')
    else:
        raise SystemExit(f'unknown op {op}')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_image_format='WEBP', export_yup=True)
print('model-fix', ops, '->', path)
