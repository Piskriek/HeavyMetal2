# =============================================================================
#  tools/unreal/import_setmix_to_ue5.py
#  -----------------------------------------------------------------------------
#  SetMix → Unreal Engine 5.5 importer.
#
#  Run inside the editor:
#      Window ▸ Developer Tools ▸ Output Log ▸ Cmd: Python
#      py "C:/setmix/tools/unreal/import_setmix_to_ue5.py" --dir "C:/exports/basalt"
#
#  Or headless:
#      UnrealEditor-Cmd.exe Project.uproject -run=pythonscript
#          -script="import_setmix_to_ue5.py --dir C:/exports/basalt --quiet"
#
#  Reads manifest.ue5.json, imports the 4K textures with correct compression
#  and sRGB flags, imports the dense OBJ with Nanite enabled, builds a
#  UMaterialInstanceConstant parented to the master Nanite PBR shader, applies
#  Lumen / distance-field / collision settings, and registers everything under
#  /Game/SetMix/Imports/<name>.
#
#  Idempotent: re-running replaces assets in place and keeps references live.
#  Tested against UE 5.5.1. Requires the "Python Editor Script Plugin".
# =============================================================================

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional

try:
    import unreal
except ImportError:  # pragma: no cover - only importable inside the editor
    sys.exit("This script must be run from within Unreal Engine 5.5.")


# ─────────────────────────────────────────────────────────────── logging ──

VERBOSE = True


def log(msg: str) -> None:
    if VERBOSE:
        unreal.log(f"[SetMix] {msg}")


def warn(msg: str) -> None:
    unreal.log_warning(f"[SetMix] {msg}")


def fail(msg: str) -> None:
    unreal.log_error(f"[SetMix] {msg}")
    raise RuntimeError(msg)


# ───────────────────────────────────────────────── compression mapping ──
#
#  Getting these wrong is the single most common cause of a "why does my
#  import look washed out / blocky" bug, so they are explicit, not inferred.

COMPRESSION = {
    "TC_Default":         unreal.TextureCompressionSettings.TC_DEFAULT,
    "TC_Masks":           unreal.TextureCompressionSettings.TC_MASKS,
    "TC_Normalmap":       unreal.TextureCompressionSettings.TC_NORMALMAP,
    "TC_Displacementmap": unreal.TextureCompressionSettings.TC_DISPLACEMENTMAP,
}

COLLISION = {
    "UseSimpleAndComplex": unreal.CollisionTraceFlag.CTF_USE_SIMPLE_AND_COMPLEX,
    "UseComplexAsSimple":  unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE,
    "UseSimpleAsComplex":  unreal.CollisionTraceFlag.CTF_USE_SIMPLE_AS_COMPLEX,
}


# ───────────────────────────────────────────────────────────── helpers ──

def asset_tools() -> Any:
    return unreal.AssetToolsHelpers.get_asset_tools()


def ensure_dir(package_path: str) -> None:
    if not unreal.EditorAssetLibrary.does_directory_exist(package_path):
        unreal.EditorAssetLibrary.make_directory(package_path)
        log(f"created {package_path}")


def delete_if_exists(package_name: str) -> None:
    if unreal.EditorAssetLibrary.does_asset_exist(package_name):
        unreal.EditorAssetLibrary.delete_asset(package_name)


# ───────────────────────────────────────────────────────────── textures ──

def import_texture(src_file: str, dest_dir: str, spec: Dict[str, Any]) -> Optional[Any]:
    """Import one PNG and apply SetMix's compression / colour-space policy."""
    if not os.path.isfile(src_file):
        warn(f"missing texture {src_file} — skipped")
        return None

    asset_name = os.path.splitext(os.path.basename(src_file))[0]
    task = unreal.AssetImportTask()
    task.filename = src_file
    task.destination_path = dest_dir
    task.destination_name = asset_name
    task.automated = True
    task.replace_existing = True
    task.save = False

    opts = unreal.TextureFactory()
    # 16-bit displacement must NOT be sRGB-decoded or it terraces.
    opts.set_editor_property("create_material", False)
    task.options = opts

    asset_tools().import_asset_tasks([task])
    if not task.imported_object_paths:
        warn(f"import produced nothing for {asset_name}")
        return None

    tex = unreal.EditorAssetLibrary.load_asset(task.imported_object_paths[0])
    if tex is None:
        return None

    tex.set_editor_property("srgb", bool(spec.get("srgb", False)))
    tex.set_editor_property(
        "compression_settings",
        COMPRESSION.get(spec.get("compression", "TC_Default"),
                        unreal.TextureCompressionSettings.TC_DEFAULT),
    )

    role = spec.get("role")
    if role == "displacement":
        # Displacement feeds World Position Offset / Nanite tessellation:
        # never compress it to DXT, never mip it with a box filter.
        tex.set_editor_property("compression_no_alpha", True)
        tex.set_editor_property("mip_gen_settings",
                                unreal.TextureMipGenSettings.TMGS_SHARPEN5)
        tex.set_editor_property("filter", unreal.TextureFilter.TF_BILINEAR)
    elif role == "rma":
        # Packed masks must stay linear and keep every channel independent.
        tex.set_editor_property("compression_no_alpha", True)
    elif role == "normal":
        tex.set_editor_property("flip_green_channel", False)  # we author OpenGL-style +Y

    # 4K hero textures: let the VT system stream them.
    if int(spec.get("width", 0)) >= 4096:
        tex.set_editor_property("virtual_texture_streaming", True)

    unreal.EditorAssetLibrary.save_loaded_asset(tex, only_if_is_dirty=False)
    log(f"texture  {asset_name:<34} {spec.get('width')}×{spec.get('height')} "
        f"{spec.get('bitDepth')}-bit {spec.get('compression')} srgb={spec.get('srgb')}")
    return tex


# ───────────────────────────────────────────────────────────────── mesh ──

def import_mesh(src_file: str, dest_dir: str, manifest: Dict[str, Any]) -> Optional[Any]:
    """Import the dense OBJ and switch Nanite on. Nanite wants the source
    DENSE — pre-decimating before import actively hurts cluster quality."""
    if not os.path.isfile(src_file):
        fail(f"mesh not found: {src_file}")

    mesh_cfg = manifest["mesh"]
    nanite_cfg = manifest["nanite"]
    lumen_cfg = manifest["lumen"]
    asset_name = os.path.splitext(os.path.basename(src_file))[0]

    task = unreal.AssetImportTask()
    task.filename = src_file
    task.destination_path = dest_dir
    task.destination_name = asset_name
    task.automated = True
    task.replace_existing = True
    task.save = False

    opts = unreal.FbxImportUI()
    opts.set_editor_property("import_mesh", True)
    opts.set_editor_property("import_textures", False)
    opts.set_editor_property("import_materials", False)
    opts.set_editor_property("import_as_skeletal", False)
    opts.set_editor_property("mesh_type_to_import",
                             unreal.FBXImportType.FBXIT_STATIC_MESH)

    smd = opts.static_mesh_import_data
    smd.set_editor_property("combine_meshes", True)
    smd.set_editor_property("generate_lightmap_u_vs", False)   # Lumen: not needed
    smd.set_editor_property("auto_generate_collision", False)  # we set it below
    smd.set_editor_property("remove_degenerates", False)       # keep the dense grid
    smd.set_editor_property("build_nanite", bool(nanite_cfg.get("enabled", True)))
    smd.set_editor_property("import_uniform_scale", 1.0)       # already centimetres
    task.options = opts

    asset_tools().import_asset_tasks([task])
    if not task.imported_object_paths:
        fail(f"mesh import produced nothing for {asset_name}")

    mesh = unreal.EditorAssetLibrary.load_asset(task.imported_object_paths[0])
    if mesh is None:
        fail(f"could not load imported mesh {asset_name}")

    # ── Nanite ────────────────────────────────────────────────────────────
    nanite = mesh.get_editor_property("nanite_settings")
    nanite.set_editor_property("enabled", bool(nanite_cfg.get("enabled", True)))
    nanite.set_editor_property("position_precision",
                               int(nanite_cfg.get("positionPrecision", 0)))
    nanite.set_editor_property("keep_percent_triangles",
                               float(nanite_cfg.get("keepTrianglePercent", 100)) / 100.0)
    nanite.set_editor_property("fallback_relative_error",
                               float(nanite_cfg.get("fallbackRelativeError", 1.0)))
    nanite.set_editor_property("trim_relative_error",
                               float(nanite_cfg.get("trimRelativeError", 0.0)))
    nanite.set_editor_property("preserve_area", bool(nanite_cfg.get("preserveArea", True)))
    mesh.set_editor_property("nanite_settings", nanite)

    # ── Lumen / distance fields ───────────────────────────────────────────
    build = mesh.get_editor_property("build_settings") if hasattr(mesh, "build_settings") else None
    if build is not None:
        build.set_editor_property("generate_distance_field_as_if_two_sided", False)
    mesh.set_editor_property(
        "distance_field_resolution_scale",
        float(lumen_cfg.get("distanceFieldResolutionScale", 2.0)),
    )
    mesh.set_editor_property(
        "generate_mesh_distance_field",
        bool(lumen_cfg.get("generateDistanceField", True)),
    )

    # ── collision — Nanite meshes need this declared explicitly ──────────
    body = mesh.get_editor_property("body_setup")
    if body is not None:
        body.set_editor_property(
            "collision_trace_flag",
            COLLISION.get(lumen_cfg.get("collisionComplexity", "UseComplexAsSimple"),
                          unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE),
        )

    unreal.EditorAssetLibrary.save_loaded_asset(mesh, only_if_is_dirty=False)
    log(f"mesh     {asset_name:<34} {mesh_cfg.get('tris', 0):,} tris · "
        f"nanite={nanite_cfg.get('enabled')} · DF scale "
        f"{lumen_cfg.get('distanceFieldResolutionScale')}")
    return mesh


# ──────────────────────────────────────────────────── material instance ──

def build_material_instance(manifest: Dict[str, Any], dest_dir: str,
                            textures: Dict[str, Any]) -> Optional[Any]:
    mat_cfg = manifest["material"]
    parent_path = mat_cfg["parent"]
    parent = unreal.EditorAssetLibrary.load_asset(parent_path)
    if parent is None:
        fail(f"master material not found: {parent_path}\n"
             f"         Import /Game/SetMix/Materials/M_SetMix_Nanite_Master first "
             f"(ships in the SetMix UE content plugin).")

    mi_name = os.path.basename(manifest["assetPaths"]["materialInstance"])
    delete_if_exists(f"{dest_dir}/{mi_name}")

    mi = asset_tools().create_asset(
        asset_name=mi_name,
        package_path=dest_dir,
        asset_class=unreal.MaterialInstanceConstant,
        factory=unreal.MaterialInstanceConstantFactoryNew(),
    )
    unreal.MaterialEditingLibrary.set_material_instance_parent(mi, parent)

    for name, value in mat_cfg.get("scalarParameters", {}).items():
        unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(
            mi, name, float(value))

    for name, rgba in mat_cfg.get("vectorParameters", {}).items():
        unreal.MaterialEditingLibrary.set_material_instance_vector_parameter_value(
            mi, name, unreal.LinearColor(*[float(c) for c in rgba]))

    for name, tex_path in mat_cfg.get("textureParameters", {}).items():
        tex = textures.get(tex_path) or unreal.EditorAssetLibrary.load_asset(tex_path)
        if tex is None:
            warn(f"texture param {name} → {tex_path} unresolved")
            continue
        unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(
            mi, name, tex)

    for name, on in mat_cfg.get("staticSwitches", {}).items():
        try:
            unreal.MaterialEditingLibrary.set_material_instance_static_switch_parameter_value(
                mi, name, bool(on))
        except Exception:  # older 5.x API surface
            warn(f"static switch {name} not settable via Python on this build")

    # The cartridge's authored knobs become searchable editor metadata, so a
    # tech artist in UE sees the same names and explanations the player saw.
    for p in manifest.get("exposedParameters", []):
        unreal.EditorAssetLibrary.set_metadata_tag(
            mi, f"SetMix.{p['path']}",
            f"{p['name']} ({p['real']}) [{p['min']}..{p['max']}] {p['unit']} — {p['explain']}")

    src = manifest["source"]
    for key, val in (("CartridgeId", src["cartridgeId"]), ("Hash", src["hash"]),
                     ("GraphHash", src["graphHash"]), ("Author", src["author"]),
                     ("Licence", src["licence"])):
        unreal.EditorAssetLibrary.set_metadata_tag(mi, f"SetMix.{key}", str(val))

    unreal.MaterialEditingLibrary.update_material_instance(mi)
    unreal.EditorAssetLibrary.save_loaded_asset(mi, only_if_is_dirty=False)
    log(f"material {mi_name:<34} {len(mat_cfg.get('scalarParameters', {}))} scalars · "
        f"{len(mat_cfg.get('textureParameters', {}))} textures")
    return mi


# ──────────────────────────────────────────────────────────────── main ──

def import_bundle(export_dir: str, content_root: Optional[str] = None) -> str:
    manifest_path = os.path.join(export_dir, "manifest.ue5.json")
    if not os.path.isfile(manifest_path):
        fail(f"manifest.ue5.json not found in {export_dir}")

    with open(manifest_path, "r", encoding="utf-8") as fh:
        manifest: Dict[str, Any] = json.load(fh)

    if manifest.get("schema") != "setmix.ue5/1.0":
        fail(f"unsupported manifest schema: {manifest.get('schema')}")

    cert = manifest.get("verification", {}).get("certificate", {})
    if not cert.get("pass", True):
        warn(f"bundle failed its export certificate: {cert.get('failures')}")

    dest_dir = content_root or manifest["assetPaths"]["root"]
    ensure_dir(dest_dir)

    t0 = time.time()
    src = manifest["source"]
    log(f"importing {src['cartridgeId']} rev {src['rev']} ({src['hash']}) → {dest_dir}")

    with unreal.ScopedSlowTask(3, "Importing SetMix bundle") as task:
        task.make_dialog(True)

        task.enter_progress_frame(1, "Textures")
        textures: Dict[str, Any] = {}
        for spec in manifest.get("textures", []):
            tex = import_texture(os.path.join(export_dir, spec["file"]), dest_dir, spec)
            if tex is not None:
                textures[f"{dest_dir}/{os.path.splitext(spec['file'])[0]}"] = tex

        task.enter_progress_frame(1, "Nanite mesh")
        import_mesh(os.path.join(export_dir, manifest["mesh"]["file"]), dest_dir, manifest)

        task.enter_progress_frame(1, "Material instance")
        build_material_instance(manifest, dest_dir, textures)

    # Assign the instance to the mesh's first slot so it drags into a level
    # fully dressed — the thing every artist actually wants.
    mesh_asset = unreal.EditorAssetLibrary.load_asset(manifest["assetPaths"]["mesh"])
    mi_asset = unreal.EditorAssetLibrary.load_asset(manifest["assetPaths"]["materialInstance"])
    if mesh_asset is not None and mi_asset is not None:
        mesh_asset.set_material(0, mi_asset)
        unreal.EditorAssetLibrary.save_loaded_asset(mesh_asset, only_if_is_dirty=False)

    unreal.AssetRegistryHelpers.get_asset_registry().scan_paths_synchronous([dest_dir], True)
    log(f"done in {time.time() - t0:.1f}s → {dest_dir}")
    return dest_dir


def main(argv: List[str]) -> int:
    global VERBOSE
    parser = argparse.ArgumentParser(description="Import a SetMix bundle into UE 5.5")
    parser.add_argument("--dir", required=True, help="folder containing manifest.ue5.json")
    parser.add_argument("--content-root", default=None, help="override /Game destination")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args(argv)

    VERBOSE = not args.quiet
    import_bundle(os.path.abspath(args.dir), args.content_root)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
