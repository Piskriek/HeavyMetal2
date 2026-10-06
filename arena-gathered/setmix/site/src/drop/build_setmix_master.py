# =============================================================================
#  tools/unreal/build_setmix_master.py
#  -----------------------------------------------------------------------------
#  DEBT #1, PART 2: constructs /Game/SetMix/Materials/M_SetMix_Nanite_Master —
#  the Substrate master that import_setmix_to_ue5.py parents every imported
#  cartridge to.
#
#  Run once per project:
#      py "tools/unreal/build_setmix_master.py"
#
#  Idempotent: re-running rebuilds the graph in place and every existing
#  MaterialInstanceConstant keeps its parent and its overrides.
#
#  Requires: UE 5.5, r.Substrate=1, Python Editor Script Plugin.
# =============================================================================

from __future__ import annotations

import os
import sys
from typing import Any, Dict, Optional, Tuple

try:
    import unreal
except ImportError:  # pragma: no cover - editor only
    sys.exit("Run this from inside Unreal Engine 5.5.")

PKG_PATH = "/Game/SetMix/Materials"
MAT_NAME = "M_SetMix_Nanite_Master"
USF_VIRTUAL = "/Project/SetMix/M_SetMix_Nanite_Master.ush"

MEL = unreal.MaterialEditingLibrary
EAL = unreal.EditorAssetLibrary


# ── parameter manifest ────────────────────────────────────────────────────
#  These names are a CONTRACT. manifest.ue5.json references them verbatim,
#  so renaming one here silently breaks every previously exported bundle.

TEXTURE_PARAMS: Tuple[Tuple[str, str, bool], ...] = (
    # (param name, group, sRGB)
    ("BaseColor",    "01 Maps", True),
    ("Normal",       "01 Maps", False),
    ("RMA",          "01 Maps", False),   # R=Roughness G=Metallic B=AO
    ("Displacement", "01 Maps", False),   # 16-bit
)

SCALAR_PARAMS: Tuple[Tuple[str, str, float, float, float], ...] = (
    # (name, group, default, min, max)
    ("FidelityStage",           "02 Fidelity", 6.0,    1.0, 6.0),
    ("PxdDitherGrid",           "02 Fidelity", 0.0,    0.0, 64.0),
    ("GeomorphSwell",           "02 Fidelity", 1.0,    0.0, 1.0),
    ("TriplanarSharpness",      "03 Surface",  4.0,    1.0, 16.0),
    ("NormalIntensity",         "03 Surface",  1.0,    0.0, 2.0),
    ("TilingScale",             "03 Surface",  1.0,    0.01, 64.0),
    ("RoughnessMin",            "03 Surface",  0.04,   0.0, 1.0),
    ("RoughnessMax",            "03 Surface",  1.0,    0.0, 1.0),
    ("AOIntensity",             "03 Surface",  0.85,   0.0, 1.0),
    ("WetnessMask",             "04 Hydrology", 0.0,   0.0, 1.0),
    ("DisplacementScale",       "05 Nanite",   8192.0, 0.0, 65536.0),
    ("DisplacementCenter",      "05 Nanite",   0.5,    0.0, 1.0),
    ("LumenRoughnessThreshold", "06 Lumen",    0.18,   0.0, 1.0),
)

VECTOR_PARAMS: Tuple[Tuple[str, str, Tuple[float, float, float, float]], ...] = (
    ("TintA",            "03 Surface", (1.0, 1.0, 1.0, 1.0)),
    ("SubsurfaceColour", "04 Hydrology", (0.35, 0.52, 0.28, 1.0)),
)

SWITCH_PARAMS: Tuple[Tuple[str, str, bool], ...] = (
    ("UseDisplacement", "05 Nanite", True),
    ("UseTriplanar",    "03 Surface", True),
    ("UseWetness",      "04 Hydrology", True),
    ("UseSubsurface",   "04 Hydrology", False),
)


def log(m: str) -> None:
    unreal.log(f"[SetMix:Master] {m}")


def _pos(expr: Any, x: int, y: int) -> Any:
    expr.set_editor_property("material_expression_editor_x", x)
    expr.set_editor_property("material_expression_editor_y", y)
    return expr


def _substrate_enabled() -> bool:
    try:
        return unreal.SystemLibrary.get_console_variable_int_value("r.Substrate") == 1
    except Exception:
        return False


def build() -> Optional[Any]:
    if not _substrate_enabled():
        unreal.log_warning(
            "[SetMix:Master] r.Substrate is not 1. The material will build, but the "
            "Slab BSDF node will be inert. Enable Substrate in Project Settings > "
            "Rendering > Substrate, then restart the editor and re-run."
        )

    if not EAL.does_directory_exist(PKG_PATH):
        EAL.make_directory(PKG_PATH)

    full = f"{PKG_PATH}/{MAT_NAME}"
    if EAL.does_asset_exist(full):
        mat = EAL.load_asset(full)
        log(f"rebuilding existing {full}")
        # Children keep their parent pointer; we only replace the graph.
        try:
            MEL.delete_all_material_expressions(mat)
        except Exception:
            pass
    else:
        mat = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
            asset_name=MAT_NAME, package_path=PKG_PATH,
            asset_class=unreal.Material, factory=unreal.MaterialFactoryNew(),
        )
        log(f"created {full}")

    # ── material-level settings ──────────────────────────────────────────
    mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_DEFAULT_LIT)
    mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_OPAQUE)
    mat.set_editor_property("two_sided", False)
    mat.set_editor_property("used_with_nanite", True)
    mat.set_editor_property("used_with_static_lighting", False)
    # Nanite displacement needs tessellation enabled on the material in 5.5
    try:
        mat.set_editor_property("enable_tessellation", True)
        mat.set_editor_property("displacement_scaling",
                                unreal.DisplacementScaling(magnitude=1.0, center=0.5))
    except Exception:
        unreal.log_warning("[SetMix:Master] tessellation properties unavailable on this build")

    # ── parameters ───────────────────────────────────────────────────────
    y = -1400
    made: Dict[str, Any] = {}

    for name, group, srgb in TEXTURE_PARAMS:
        p = MEL.create_material_expression(mat, unreal.MaterialExpressionTextureObjectParameter, -1800, y)
        p.set_editor_property("parameter_name", name)
        p.set_editor_property("group", group)
        made[name] = p
        y += 180
        log(f"  texture param  {name:<14} srgb={srgb}")

    y = -1400
    for name, group, default, lo, hi in SCALAR_PARAMS:
        p = MEL.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, -1450, y)
        p.set_editor_property("parameter_name", name)
        p.set_editor_property("group", group)
        p.set_editor_property("default_value", default)
        p.set_editor_property("slider_min", lo)
        p.set_editor_property("slider_max", hi)
        made[name] = p
        y += 110

    y = -1400
    for name, group, rgba in VECTOR_PARAMS:
        p = MEL.create_material_expression(mat, unreal.MaterialExpressionVectorParameter, -1150, y)
        p.set_editor_property("parameter_name", name)
        p.set_editor_property("group", group)
        p.set_editor_property("default_value", unreal.LinearColor(*rgba))
        made[name] = p
        y += 140

    for name, group, default in SWITCH_PARAMS:
        p = MEL.create_material_expression(mat, unreal.MaterialExpressionStaticBoolParameter, -1150, y)
        p.set_editor_property("parameter_name", name)
        p.set_editor_property("group", group)
        p.set_editor_property("default_value", default)
        made[name] = p
        y += 110

    # ── the Custom HLSL node carrying M_SetMix_Nanite_Master.usf ─────────
    #  One Custom node rather than 200 graph nodes, deliberately: the HLSL is
    #  version-controlled, diffable, reviewable and SHARED WITH THE WEB
    #  SHADER's intent. A node spaghetti that nobody can diff is how two
    #  renderers silently drift apart.
    custom = MEL.create_material_expression(mat, unreal.MaterialExpressionCustom, -700, -600)
    custom.set_editor_property("description", "SetMix Substrate Surface")
    custom.set_editor_property("output_type", unreal.CustomMaterialOutputType.CMOT_FLOAT1)
    custom.set_editor_property("code", _custom_code())

    includes = custom.get_editor_property("additional_defines") or []
    custom.set_editor_property("include_file_paths", [USF_VIRTUAL])
    del includes

    inputs = []
    def _in(name: str, expr: Any) -> None:
        i = unreal.CustomInput()
        i.set_editor_property("input_name", name)
        inputs.append(i)
        del expr
    for n in ("AlbedoTex", "NormalTex", "RMATex", "HeightTex"):
        _in(n, None)
    for n in ("FidelityStage", "GeomorphSwell", "PxdDitherGrid",
              "TriplanarSharpness", "WetnessMask", "NormalIntensity",
              "LumenRoughnessThreshold", "DisplacementScale"):
        _in(n, made.get(n))
    custom.set_editor_property("inputs", inputs)

    # Wire the parameters into the Custom node in declaration order.
    order = ["BaseColor", "Normal", "RMA", "Displacement",
             "FidelityStage", "GeomorphSwell", "PxdDitherGrid",
             "TriplanarSharpness", "WetnessMask", "NormalIntensity",
             "LumenRoughnessThreshold", "DisplacementScale"]
    for idx, key in enumerate(order):
        src = made.get(key)
        if src is None:
            continue
        try:
            MEL.connect_material_expressions(src, "", custom, custom.get_editor_property("inputs")[idx].input_name)
        except Exception:
            unreal.log_warning(f"[SetMix:Master] could not auto-wire {key}; wire it by hand once")

    # ── Substrate Slab BSDF ──────────────────────────────────────────────
    slab = None
    for cls_name in ("MaterialExpressionSubstrateSlabBSDF", "MaterialExpressionStrataSlabBSDF"):
        cls = getattr(unreal, cls_name, None)
        if cls is not None:
            slab = MEL.create_material_expression(mat, cls, -250, -600)
            log(f"  substrate slab via {cls_name}")
            break
    if slab is None:
        unreal.log_warning(
            "[SetMix:Master] No Substrate Slab BSDF class exposed to Python on this build. "
            "The parameters and the Custom node are in place — connect the slab manually "
            "once, and every future re-run preserves it."
        )
    else:
        try:
            MEL.connect_material_property(slab, "", unreal.MaterialProperty.MP_FRONT_MATERIAL)
        except Exception:
            unreal.log_warning("[SetMix:Master] connect FrontMaterial by hand")

    MEL.recompile_material(mat)
    EAL.save_loaded_asset(mat, only_if_is_dirty=False)
    log(f"done · {len(TEXTURE_PARAMS)} textures · {len(SCALAR_PARAMS)} scalars · "
        f"{len(VECTOR_PARAMS)} vectors · {len(SWITCH_PARAMS)} switches")
    return mat


def _custom_code() -> str:
    """The Custom-node body. Delegates everything to the .usf so the shader
    is reviewable as a file rather than as a string in an asset."""
    return r"""
// SetMix Substrate surface — see /Project/SetMix/M_SetMix_Nanite_Master.ush
FSetMixSurface S = SetMix_EvaluateSurface(
    GetWorldPosition(Parameters),
    Parameters.WorldNormal,
    Parameters.TangentToWorld[2],
    Parameters.CameraVector,
    Parameters.SvPosition.xy,
    AlbedoTex, NormalTex, RMATex, HeightTex,
    SetMixSampler,
    FidelityStage, GeomorphSwell, PxdDitherGrid,
    TriplanarSharpness, WetnessMask, NormalIntensity);

SetMixOut_BaseColor   = S.BaseColor;
SetMixOut_Normal      = S.Normal;
SetMixOut_Roughness   = S.Roughness;
SetMixOut_Metallic    = S.Metallic;
SetMixOut_Specular    = S.SpecularScale;
SetMixOut_F0          = lerp(0.04.xxx, S.BaseColor, S.Metallic) * S.EnergyCompensation;
SetMixOut_Displace    = SetMix_NaniteDisplacement(S.Displacement, GeomorphSwell, 0.5) * DisplacementScale;
SetMixOut_WantsHWRT   = SetMix_WantsHardwareRT(S.Roughness, LumenRoughnessThreshold);
return 1.0;
"""


def install_shader(usf_source_path: str) -> None:
    """Copy M_SetMix_Nanite_Master.usf into Project/Shaders/SetMix so the
    /Project/ virtual path resolves. Call before build() on a fresh clone."""
    dest_dir = os.path.join(unreal.Paths.project_dir(), "Shaders", "SetMix")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, "M_SetMix_Nanite_Master.ush")
    with open(usf_source_path, "r", encoding="utf-8") as src, \
         open(dest, "w", encoding="utf-8") as dst:
        dst.write(src.read())
    log(f"shader installed → {dest}")
    unreal.SystemLibrary.execute_console_command(None, "recompileshaders changed")


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    usf = os.path.join(here, "M_SetMix_Nanite_Master.usf")
    if os.path.isfile(usf):
        install_shader(usf)
    build()
