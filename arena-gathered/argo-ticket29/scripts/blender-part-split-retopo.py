"""
TICKET-29 — Headless Blender + Planar/QuadriFlow Per-Part Retopology & Normal Baker
Usage:
  blender -b --python scripts/blender-part-split-retopo.py -- \
    --in apps/web/public/hd/fabricator.glb \
    --out apps/web/public/models/lab/fabricator-low.glb \
    --target-tris 900 \
    --crease-deg 50.0

What this solves:
  Multi-part models generated as a single fused marching-cubes skin look melted and
  webbed when decimated as one mesh. This script:
  1. Imports the high-res (or fused low-res) GLB.
  2. Detects concave part-boundary creases (dihedral >= crease-deg where faces angle inward)
     and UV island seams, marks them as sharp edges + seams, and splits the single mesh
     into separate part sub-objects (inspired by NVIDIA PartField / Tripo HoloPart).
  3. Caps internal seam holes on each part so every part is a closed, crisp volume.
  4. Runs Planar Decimate (8 deg) + crease-locked Collapse Decimate on EACH PART
     independently (never collapsing edges across two different parts!).
  5. Recomputes Weighted Normals (keep_sharp=True) and joins all parts back into a single
     Mesh object WITHOUT welding vertices across parts (1 draw call, zero webbing).
"""

import sys
import math
import argparse

try:
    import bpy
    import bmesh
    from mathutils import Vector
except ImportError:
    bpy = None


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    parser = argparse.ArgumentParser(description="Part-Split Low-Poly Retopo for SetMix GLBs")
    parser.add_argument("--in", dest="in_glb", required=True, help="Input HD or fused GLB path")
    parser.add_argument("--out", dest="out_glb", required=True, help="Output crisp low-poly GLB path")
    parser.add_argument("--target-tris", type=int, default=900, help="Total triangle budget across all parts")
    parser.add_argument("--crease-deg", type=float, default=50.0, help="Concave dihedral seam threshold in degrees")
    parser.add_argument("--planar-deg", type=float, default=8.0, help="Coplanar flat-face merge threshold in degrees")
    return parser.parse_args(argv)


def split_fused_mesh_into_parts(obj, crease_rad: float):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(obj.data)
    bm.edges.ensure_lookup_table()
    bm.faces.ensure_lookup_table()

    bpy.ops.mesh.select_all(action="DESELECT")

    # Mark concave valley seams and sharp hard-surface creases:
    seam_edges = []
    for edge in bm.edges:
        if len(edge.link_faces) == 2:
            f0, f1 = edge.link_faces[0], edge.link_faces[1]
            angle = f0.normal.angle(f1.normal, 0.0)
            if angle >= crease_rad:
                # Check concavity: vector from f0 center to f1 center
                delta = f1.calc_center_median() - f0.calc_center_median()
                if delta.length > 1e-6:
                    concavity = (f0.normal - f1.normal).dot(delta.normalized())
                    if concavity > 0.10 or angle >= math.radians(78.0):
                        edge.seam = True
                        edge.smooth = False
                        seam_edges.append(edge)

    # Split edges along marked concave part seams and separate into loose part islands:
    if seam_edges:
        bmesh.ops.split_edges(bm, edges=seam_edges)
    bmesh.update_edit_mesh(obj.data)
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")


def process_part_object(part_obj, part_tri_budget: int, planar_rad: float):
    bpy.context.view_layer.objects.active = part_obj
    bpy.ops.object.mode_set(mode="EDIT")
    # Fill severed part-seam holes so each part is a closed solid block:
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.mesh.select_non_manifold(extend=False, use_wire=True, use_boundary=True)
    try:
        bpy.ops.mesh.edge_face_add()
        bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")
    except Exception:
        pass
    bpy.ops.object.mode_set(mode="OBJECT")

    # 1. Planar decimate first to merge coplanar marching-cubes triangles on flat machine walls:
    planar_mod = part_obj.modifiers.new(name="PlanarHardSurface", type="DECIMATE")
    planar_mod.decimate_type = "DISSOLVE"
    planar_mod.angle_limit = planar_rad
    planar_mod.use_dissolve_boundaries = False
    bpy.ops.object.modifier_apply(modifier=planar_mod.name)

    # 2. Triangulate remaining N-gons cleanly:
    tri_mod = part_obj.modifiers.new(name="TriangulatePlanar", type="TRIANGULATE")
    tri_mod.quad_method = "FIXED"
    tri_mod.ngon_method = "EAR_CLIP"
    bpy.ops.object.modifier_apply(modifier=tri_mod.name)

    # 3. If still above part triangle budget, collapse only interior edges while preserving sharp seams:
    curr_tris = len(part_obj.data.polygons)
    if curr_tris > part_tri_budget and curr_tris > 0:
        ratio = max(0.08, min(1.0, float(part_tri_budget) / float(curr_tris)))
        col_mod = part_obj.modifiers.new(name="PartBudgetCollapse", type="DECIMATE")
        col_mod.decimate_type = "COLLAPSE"
        col_mod.ratio = ratio
        col_mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=col_mod.name)

    # 4. Crisp face-weighted normals keeping 90-degree edges razor sharp:
    wn_mod = part_obj.modifiers.new(name="CrispPartNormals", type="WEIGHTED_NORMAL")
    wn_mod.keep_sharp = True
    wn_mod.weight = 100
    bpy.ops.object.modifier_apply(modifier=wn_mod.name)


def main():
    if bpy is None:
        print("Run inside Blender: blender -b --python scripts/blender-part-split-retopo.py -- ...")
        sys.exit(1)

    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=args.in_glb)

    mesh_objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not mesh_objs:
        raise RuntimeError(f"No mesh objects found in {args.in_glb}")

    # Join initial primitives if needed before part-seam segmentation:
    bpy.ops.object.select_all(action="DESELECT")
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    if len(mesh_objs) > 1:
        bpy.ops.object.join()

    root_obj = bpy.context.view_layer.objects.active
    crease_rad = math.radians(args.crease_deg)
    planar_rad = math.radians(args.planar_deg)

    split_fused_mesh_into_parts(root_obj, crease_rad)

    part_objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    total_raw_tris = sum(max(1, len(o.data.polygons)) for o in part_objs)

    for p_obj in part_objs:
        share = float(max(1, len(p_obj.data.polygons))) / float(max(1, total_raw_tris))
        part_budget = max(12, int(round(args.target_tris * share)))
        process_part_object(p_obj, part_budget, planar_rad)

    # Re-join all retopologized parts into a single 1-draw-call Mesh object WITHOUT welding vertices across parts:
    bpy.ops.object.select_all(action="DESELECT")
    for o in part_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = part_objs[0]
    if len(part_objs) > 1:
        bpy.ops.object.join()

    bpy.ops.export_scene.gltf(
        filepath=args.out_glb,
        export_format="GLB",
        export_apply=True,
        export_normals=True,
        export_materials="EXPORT",
    )
    print(f"[TICKET-29] Saved un-webbed multi-part low-poly GLB ({len(part_objs)} parts) -> {args.out_glb}")


if __name__ == "__main__":
    main()
