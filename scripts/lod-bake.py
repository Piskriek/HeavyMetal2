# Makes one detail level of a generated model, headless in Blender.
#   blender -b --factory-startup -P scripts/lod-bake.py -- <full.glb> <out.glb> <triangles> <texture px> <flat|smooth> [--no-weld]
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

# Weld the texture islands back together first. The generated mesh arrives as thousands of disconnected UV
# islands (every island border is an open edge), so Decimate shrank each island on its own and the borders pulled
# apart: that was the "shattering". Merging by distance makes one connected surface; Blender keeps UVs per corner,
# so the maps still fit and the island borders become ordinary UV seams.
if '--no-weld' not in argv:
    bpy.ops.object.select_all(action='DESELECT')
    high.select_set(True)
    bpy.context.view_layer.objects.active = high
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0001)
    bpy.ops.object.mode_set(mode='OBJECT')

# Drop floating debris: generated meshes can carry small loose fragments clear of the object (a stray chunk beside
# the scout wheel), which also breaks the nothing-floats rule. Split into loose parts and delete every part whose
# box lies entirely outside the largest part's box (grown by 2% of its size); parts touching the body stay.
if '--keep-debris' not in argv:
    from mathutils import Vector
    bpy.ops.object.select_all(action='DESELECT')
    high.select_set(True)
    bpy.context.view_layer.objects.active = high
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')
    parts = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    def box(o):
        pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
        return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    main = max(parts, key=lambda o: len(o.data.polygons))
    mlo, mhi = box(main)
    # a uniform margin, 3% of the main part's diagonal: a per-axis 2% was under 3 mm across a thin wall, so a wall's
    # separate back skin counted as "outside" and was deleted (the window wall lost its back half, TASK-10b review)
    d = (mhi - mlo).length * 0.03
    grow = Vector((d, d, d))
    mlo, mhi = mlo - grow, mhi + grow
    dropped, keep = 0, [main]
    for o in parts:
        if o is main:
            continue
        lo, hi = box(o)
        outside = hi.x < mlo.x or lo.x > mhi.x or hi.y < mlo.y or lo.y > mhi.y or hi.z < mlo.z or lo.z > mhi.z
        if outside:
            bpy.data.objects.remove(o, do_unlink=True)
            dropped += 1
        else:
            keep.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in keep:
        o.select_set(True)
    bpy.context.view_layer.objects.active = main
    if len(keep) > 1:
        bpy.ops.object.join()
    high = bpy.context.view_layer.objects.active
    high.name = 'high'
    print(f'debris: {len(parts)} loose parts, {dropped} floating dropped')

# the low copy, decimated to the target
low = high.copy()
low.data = high.data.copy()
low.name = 'low'
bpy.context.collection.objects.link(low)
tris = sum(len(p.vertices) - 2 for p in low.data.polygons)


def source_colour():
    """The full model's main colour (the average of its colour map, linear), the fill behind the colour bake."""
    bsdf = next(n for n in high.active_material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    col = tuple(bsdf.inputs['Base Color'].default_value)
    link = bsdf.inputs['Base Color'].links
    if link and link[0].from_node.type == 'TEX_IMAGE' and link[0].from_node.image:
        px = link[0].from_node.image.pixels[:]
        n = len(px) // 4
        step = max(1, n // 4096)
        acc, k = [0.0, 0.0, 0.0], 0
        for i in range(0, n, step):
            for c in range(3):
                acc[c] += px[i * 4 + c]
            k += 1
        lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        col = (lin(acc[0] / k), lin(acc[1] / k), lin(acc[2] / k), 1.0)
    return col


def bake_target(name, colorspace, fill):
    """A new image on the low copy's material, made the active node so the next bake writes into it. It starts as
    `fill`, not black: a texel whose ray misses the full model (a recess deeper than the ray reach) keeps the fill,
    so a miss shows as plain colour or a flat normal, not the black patches the props review found (2026-10-12)."""
    nodes = low.active_material.node_tree.nodes
    img = bpy.data.images.new(name, size, size, alpha=False)
    img.colorspace_settings.name = colorspace
    img.generated_color = fill
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = img
    for n in nodes:
        n.select = False
    tex.select = True
    nodes.active = tex
    return img, tex


def bake(kind, **kw):
    dims = low.dimensions
    diag = (dims.x ** 2 + dims.y ** 2 + dims.z ** 2) ** 0.5
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 4
    b = scene.render.bake
    b.use_selected_to_active = True
    # --reach=K: K times the usual ray reach, for pieces with deep recesses (a lid set into a crate's top)
    reach = next((float(a.split('=')[1]) for a in argv if a.startswith('--reach=')), 1.0)
    b.cage_extrusion = 0.01 * diag * reach
    b.max_ray_distance = 0.03 * diag * reach
    b.use_clear = False
    b.normal_space = 'TANGENT'
    b.margin = 8
    bpy.ops.object.select_all(action='DESELECT')
    high.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    bpy.ops.object.bake(type=kind, **kw)


# --retopo[=N]: rebuild the surface instead of decimating the generated one. Collapse decimation has to keep the
# generated UV islands (the colour map is laid out on them), so every island border is a constraint it can only
# bend, and thin or holed parts tear. Here the copy is voxel-remeshed into one closed seamless surface (N voxels
# across its longest side), decimated freely, unwrapped fresh, and the full model's colour is baked onto it: the
# usual high-to-low game-art route. Parts thinner than about two voxels are filled or dropped (they tore anyway).
retopo = next((a for a in argv if a.startswith('--retopo')), None)
if retopo:
    # N = 0 skips the remesh: the welded surface is decimated with its UV islands dropped (nothing to guard)
    vox = int(retopo.split('=')[1]) if '=' in retopo else 160
    bpy.ops.object.select_all(action='DESELECT')
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    while low.data.uv_layers:
        low.data.uv_layers.remove(low.data.uv_layers[0])
    if vox > 0:
        rm = low.modifiers.new('remesh', 'REMESH')
        rm.mode = 'VOXEL'
        rm.voxel_size = max(low.dimensions) / vox
        rm.adaptivity = 0
        bpy.ops.object.modifier_apply(modifier=rm.name)
    # --planar=D: dissolve near-flat regions first (faces within D degrees merge), so a panel becomes a few clean faces
    # and the collapse spends the budget on edges and curves: the cage for hard-surface parts (owner 2026-10-11)
    planar = next((a for a in argv if a.startswith('--planar=')), None)

    def reduce(obj, budget):
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        if planar:
            pd = obj.modifiers.new('planar', 'DECIMATE')
            pd.decimate_type = 'DISSOLVE'
            pd.angle_limit = math.radians(float(planar.split('=')[1]))
            bpy.ops.object.modifier_apply(modifier=pd.name)
            tri = obj.modifiers.new('tri', 'TRIANGULATE')
            bpy.ops.object.modifier_apply(modifier=tri.name)
        dense = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        if budget < dense:
            dec = obj.modifiers.new('decimate', 'DECIMATE')
            dec.decimate_type = 'COLLAPSE'
            dec.ratio = budget / dense
            dec.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=dec.name)
        return dense

    # --parts=FILE (TICKET-29, docs/argo/plans/37): a generated model is one fused skin, so one collapse across it
    # melts the gap between two parts into a web. FILE holds a part id per face of norm.glb (from SAMPart3D on the 3D
    # PC) as {centroids: [x,y,z,...] in glTF axes, labels: [...]}. Each face of the welded copy takes the label of the
    # nearest centroid (import and weld reorder faces), the copy is cut into one object per part, every part is
    # reduced on its own share of the budget (by area, at least 12), and the parts are joined back without welding:
    # still one mesh and one draw call, and no edge collapses across two parts.
    parts_arg = next((a for a in argv if a.startswith('--parts=')), None)
    if parts_arg:
        import json
        from mathutils import kdtree
        spec = json.load(open(parts_arg.split('=', 1)[1]))
        cs, labels = spec['centroids'], spec['labels']
        tree = kdtree.KDTree(len(labels))
        for i in range(len(labels)):
            # glTF is Y-up, Blender Z-up: the importer maps (x, y, z) to (x, -z, y)
            tree.insert((cs[3 * i], -cs[3 * i + 2], cs[3 * i + 1]), i)
        tree.balance()
        import bmesh
        mw = low.matrix_world
        # the label rides on a face attribute, which survives each separate (face indices do not)
        attr = low.data.attributes.new('part', 'INT', 'FACE')
        areas = {}
        for p in low.data.polygons:
            k = labels[tree.find(mw @ p.center)[1]]
            attr.data[p.index].value = k
            areas[k] = areas.get(k, 0.0) + p.area
        ids = sorted(areas)
        total = sum(areas.values()) or 1.0
        pieces, dense = [], 0
        for k in ids:
            bpy.ops.object.select_all(action='DESELECT')
            low.select_set(True)
            bpy.context.view_layer.objects.active = low
            bpy.ops.object.mode_set(mode='EDIT')
            bm = bmesh.from_edit_mesh(low.data)
            layer = bm.faces.layers.int['part']
            for f in bm.faces:
                f.select_set(False)
            for f in bm.faces:
                if f[layer] == k:
                    f.select_set(True)
            bm.select_flush_mode()
            bmesh.update_edit_mesh(low.data)
            bpy.ops.mesh.separate(type='SELECTED')
            bpy.ops.object.mode_set(mode='OBJECT')
            piece = next(o for o in bpy.context.selected_objects if o is not low)
            dense += reduce(piece, max(12, round(target * areas[k] / total)))
            pieces.append(piece)
        bpy.ops.object.select_all(action='DESELECT')
        for o in pieces:
            o.select_set(True)
        low.select_set(True)
        bpy.context.view_layer.objects.active = low
        bpy.ops.object.join()
        low = bpy.context.view_layer.objects.active
        low.name = 'low'
        low.data.attributes.remove(low.data.attributes['part'])
        print(f'parts: {len(ids)} parts, {sum(len(p.vertices) - 2 for p in low.data.polygons)} triangles')
    else:
        dense = reduce(low, target)
    low.data.uv_layers.new(name='UVMap')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.01)
    bpy.ops.object.mode_set(mode='OBJECT')
    src_bsdf = next(n for n in high.active_material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    mat = bpy.data.materials.new('baked')
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    for k in ('Metallic', 'Roughness'):
        bsdf.inputs[k].default_value = src_bsdf.inputs[k].default_value
    low.data.materials.clear()
    low.data.materials.append(mat)
    img, tex = bake_target('color', 'sRGB', source_colour())
    # a fully metallic surface has no diffuse colour to bake (the generated models are all metallic 1): bake the
    # albedo from a non-metal copy of the source; the low keeps the source's metallic value
    # every material, not just the first: a `fix` plain-back material stayed metallic and baked black
    for m in high.data.materials:
        for n in m.node_tree.nodes if m and m.use_nodes else []:
            if n.type == 'BSDF_PRINCIPLED':
                n.inputs['Metallic'].default_value = 0
    bake('DIFFUSE', pass_filter={'COLOR'})
    mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    img.pack()
    print(f'retopo: voxel {vox} -> {dense} triangles')
elif target < tris:
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
    if not retopo:
        mat = mat.copy()
        low.active_material = mat
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    img, tex = bake_target('normal', 'Non-Color', (0.5, 0.5, 1.0, 1.0))
    bake('NORMAL')
    nmap = nodes.new('ShaderNodeNormalMap')
    links.new(tex.outputs['Color'], nmap.inputs['Color'])
    links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    img.pack()

bpy.data.objects.remove(high, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
low.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_tangents=(mode != 'flat'), export_image_format='WEBP', export_yup=True)
print(f'lod {mode}: {tris} -> {sum(len(p.vertices) - 2 for p in low.data.polygons)} triangles -> {out}')
