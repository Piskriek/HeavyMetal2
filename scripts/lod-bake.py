# Makes one detail level of a generated model, headless in Blender.
#   blender -b --factory-startup -P scripts/lod-bake.py -- <full.glb> <out.glb> <triangles> <texture px> <flat|smooth>
# Generated meshes are cut into many texture islands; meshopt's simplifier guards their borders and stalls (11.8k
# triangles of a 1.2k target), so Blender's Decimate (collapse) does the reduction: it works across seams and
# carries the UVs, so the original colour and metal/roughness maps still fit.
#   flat:   flat shading, no normal map (the faceted stage-1 look);
#   smooth: smooth by angle (30 deg: curved panels smooth, hard edges crisp) plus a tangent-space normal map baked
#           from the full mesh, so screws, seams and vents come back.
# Textures stay at source size here; scripts/slim-glb.mjs packs them (WebP at the level's size, meshopt).
import math
import sys
import bpy

argv = sys.argv[sys.argv.index('--') + 1:]
src, out, target, size, mode = argv[0], argv[1], int(argv[2]), int(argv[3]), argv[4]

bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
high = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
high.name = 'high'

# the low copy, decimated to the target
low = high.copy()
low.data = high.data.copy()
low.name = 'low'
bpy.context.collection.objects.link(low)
tris = sum(len(p.vertices) - 2 for p in low.data.polygons)
if target < tris:
    dec = low.modifiers.new('decimate', 'DECIMATE')
    dec.decimate_type = 'COLLAPSE'
    dec.ratio = target / tris
    dec.use_collapse_triangulate = True
    bpy.ops.object.select_all(action='DESELECT')
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    bpy.ops.object.modifier_apply(modifier=dec.name)

bpy.ops.object.select_all(action='DESELECT')
low.select_set(True)
bpy.context.view_layer.objects.active = low
mat = low.active_material
nodes, links = mat.node_tree.nodes, mat.node_tree.links
bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
# the generated normal map was made for the dense surface: drop it on every level
for link in list(bsdf.inputs['Normal'].links):
    links.remove(link)

if mode == 'flat':
    bpy.ops.object.shade_flat()
else:
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))
    # the low copy shares the high mesh's material: give it its own before adding the bake target
    mat = mat.copy()
    low.active_material = mat
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    img = bpy.data.images.new('normal', size, size, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = img
    for n in nodes:
        n.select = False
    tex.select = True
    nodes.active = tex
    dims = low.dimensions
    diag = (dims.x ** 2 + dims.y ** 2 + dims.z ** 2) ** 0.5
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 4
    bake = scene.render.bake
    bake.use_selected_to_active = True
    bake.cage_extrusion = 0.01 * diag
    bake.max_ray_distance = 0.03 * diag
    bake.normal_space = 'TANGENT'
    bake.margin = 8
    high.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    bpy.ops.object.bake(type='NORMAL')
    nmap = nodes.new('ShaderNodeNormalMap')
    links.new(tex.outputs['Color'], nmap.inputs['Color'])
    links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    img.pack()

bpy.data.objects.remove(high, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
low.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_tangents=(mode != 'flat'), export_image_format='WEBP', export_yup=True)
print(f'lod {mode}: {tris} -> {sum(len(p.vertices) - 2 for p in low.data.polygons)} triangles -> {out}')
