# Bakes a dense generated model's surface detail into a normal map on its slimmed copy, headless in Blender.
#   "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup -P scripts/bake-normals.py -- <high.glb> <low.glb> <out.glb> [size]
# The low mesh comes from scripts/slim-glb.mjs --angle 30: the same UVs and colour maps as the high one, hard edges
# kept by angle, and no normal map (the generated one was made for the dense surface). This bakes a tangent-space
# normal map from high to low (Cycles, selected to active, a small cage), wires it into the low material and exports
# a GLB with tangents (three.js then shades with the same basis Blender baked in) and WebP textures.
import sys
import bpy

argv = sys.argv[sys.argv.index('--') + 1:]
high_path, low_path, out_path = argv[0], argv[1], argv[2]
size = int(argv[3]) if len(argv) > 3 else 1024

bpy.ops.wm.read_factory_settings(use_empty=True)


def import_mesh(path, name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    # bake in world space: apply the importer's transforms (y-up to z-up and any node scale)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.name = name
    return obj


high = import_mesh(high_path, 'high')
low = import_mesh(low_path, 'low')

dims = low.dimensions
diag = (dims.x ** 2 + dims.y ** 2 + dims.z ** 2) ** 0.5

# the bake target: a non-colour image on an image node that is the active node of the low material
img = bpy.data.images.new('normal', size, size, alpha=False)
img.colorspace_settings.name = 'Non-Color'
mat = low.active_material
nodes, links = mat.node_tree.nodes, mat.node_tree.links
tex = nodes.new('ShaderNodeTexImage')
tex.image = img
tex.interpolation = 'Linear'
for n in nodes:
    n.select = False
tex.select = True
nodes.active = tex

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

bpy.ops.object.select_all(action='DESELECT')
high.select_set(True)
low.select_set(True)
bpy.context.view_layer.objects.active = low
bpy.ops.object.bake(type='NORMAL')

# wire the baked map into the material's normal input
bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
nmap = nodes.new('ShaderNodeNormalMap')
links.new(tex.outputs['Color'], nmap.inputs['Color'])
links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
img.pack()

bpy.data.objects.remove(high, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
low.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=True,
    export_tangents=True,
    export_image_format='WEBP',
    export_yup=True,
)
print(f'baked {size}x{size} normal map: {high_path} -> {low_path} -> {out_path} ({len(low.data.polygons)} faces)')
