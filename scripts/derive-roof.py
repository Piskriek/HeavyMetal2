# Derives a roof corner from the generated pitched roof, headless in Blender, the way the procedural kit builds its
# corners (packages/basekit: roofOuterCorner y = 3/4 min(x, z), roofInnerCorner y = 3/4 max(x, z), from the pitched
# roof's y = 3/4 z).
#   blender -b --factory-startup -P scripts/derive-roof.py -- <pitched norm.glb> <out.glb> <hip|valley>
# The pitched roof is cut on the cell's diagonal x = z (glTF axes); hip keeps the half under its low eave (z <= x),
# valley the half under its high edge (z >= x); the kept half is mirrored across the diagonal and the two are welded
# along the cut. The surfaces agree on the diagonal, so the halves meet in a clean hip or valley line, the standing
# seams run downhill on both faces, and the colour map still fits (UVs are kept per corner).
# Image-to-3D could not make these: it cannot see a corner piece's back and completed the outer corner as a pyramid.
import sys
import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, out, mode = argv[0], argv[1], argv[2]
assert mode in ('hip', 'valley'), mode

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Blender is z-up: glTF (x, y, z) is Blender (x, -z, y), so the diagonal x = z is x + y = 0 here, and glTF z <= x
# (the hip half) is the side x + y >= 0
n = Vector((1, 1, 0)).normalized()
bm = bmesh.new()
bm.from_mesh(obj.data)
geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=(0, 0, 0), plane_no=n, clear_inner=(mode == 'hip'), clear_outer=(mode == 'valley'))
half = len(bm.faces)
# the mirror image across the diagonal: p - 2 (n . p) n, i.e. (x, y, z) -> (-y, -x, z); its winding comes out reversed
mirror = Matrix(((0, -1, 0, 0), (-1, 0, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)))
dup = bmesh.ops.duplicate(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:])
copied = [g for g in dup['geom'] if isinstance(g, bmesh.types.BMVert)]
bmesh.ops.transform(bm, matrix=mirror, verts=copied)
bmesh.ops.reverse_faces(bm, faces=[g for g in dup['geom'] if isinstance(g, bmesh.types.BMFace)])
# the cut vertices lie on the diagonal, so each half's cut meets its mirror exactly: weld them
bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
bm.to_mesh(obj.data)
bm.free()
obj.data.update()

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_image_format='WEBP', export_yup=True)
print(f'derive {mode}: {half} faces per half -> {out}')
