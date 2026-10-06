# =============================================================================
#  tools/unreal/SetmixLiveLink.py
#  -----------------------------------------------------------------------------
#  SETMIX ⟷ UNREAL ENGINE 5.5 REAL-TIME LIVE LINK
#
#  Monitor 1: the browser runtime, authoritative, 120 Hz.
#  Monitor 2: this. Nanite + Lumen + Substrate, mirroring every edit live.
#
#  Install:
#      1. Enable "Python Editor Script Plugin" and "Editor Scripting Utilities"
#      2. Project Settings ▸ Python ▸ Startup Scripts ▸ add this file
#         (or run it once from the Output Log: py "…/SetmixLiveLink.py")
#      3. Start the bridge:  bun run scripts/ue5-bridge.ts
#      4. Toolbar ▸ SetMix ▸ Connect Live Link
#
#  DESIGN NOTE THAT MATTERS
#  Unreal's Python runs on the GAME THREAD. A blocking socket read would
#  freeze the editor, so the socket lives on a worker thread that only ever
#  appends to a deque, and a Slate tick drains that deque on the game thread.
#  Every unreal.* call below therefore happens where it is legal to happen.
#
#  Tested against UE 5.5.1.
# =============================================================================

from __future__ import annotations

import base64
import hashlib
import json
import math
import os
import socket
import struct
import threading
import time
from collections import deque
from typing import Any, Deque, Dict, Optional, Tuple

try:
    import unreal
except ImportError:  # pragma: no cover
    raise SystemExit("SetmixLiveLink must run inside Unreal Engine 5.5.")


# ─────────────────────────────────────────────────────────── protocol ──
# Mirrors scripts/ue5-bridge.ts byte for byte. If you change one, change both.

MAGIC = 0x534D584C  # 'SMXL'
VERSION = 1
HEADER = 16

OP_HELLO        = 0x01
OP_HEARTBEAT    = 0x02
OP_FIDELITY     = 0x10
OP_CARTRIDGE    = 0x11
OP_VARIABLE     = 0x12
OP_WAVE         = 0x20
OP_CHUNK_DELTA  = 0x21
OP_ROVER        = 0x30
OP_AVATAR       = 0x31
OP_MODE         = 0x32
OP_RESYNC       = 0x40
OP_ACK          = 0x41

OP_NAMES = {
    OP_FIDELITY: "FIDELITY", OP_CARTRIDGE: "CARTRIDGE", OP_VARIABLE: "VARIABLE",
    OP_WAVE: "WAVE", OP_CHUNK_DELTA: "CHUNK_DELTA", OP_ROVER: "ROVER",
    OP_AVATAR: "AVATAR", OP_MODE: "MODE", OP_RESYNC: "RESYNC",
}

CONTENT_ROOT = "/Game/SetMix/LiveLink"
MASTER_MATERIAL = "/Game/SetMix/Materials/M_SetMix_Nanite_Master"

# SetMix works in metres, Unreal in centimetres. One constant, one place.
M_TO_CM = 100.0


def encode(op: int, tick: int, payload: bytes, flags: int = 0) -> bytes:
    return struct.pack("<IBBHII", MAGIC, VERSION, op, flags, tick & 0xFFFFFFFF,
                       len(payload)) + payload


def decode(buf: bytes) -> Optional[Tuple[int, int, int, bytes]]:
    if len(buf) < HEADER:
        return None
    magic, ver, op, flags, tick, n = struct.unpack("<IBBHII", buf[:HEADER])
    if magic != MAGIC or ver != VERSION or len(buf) < HEADER + n:
        return None
    return op, tick, flags, buf[HEADER:HEADER + n]


# ───────────────────────────────── minimal RFC-6455 client (no deps) ──

class WSClient:
    """Blocking WebSocket client. Lives on a worker thread, never the game thread."""

    def __init__(self, host: str = "localhost", port: int = 8787) -> None:
        self.host, self.port = host, port
        self.sock: Optional[socket.socket] = None
        self.buf = b""
        self.connected = False

    def connect(self) -> bool:
        try:
            self.sock = socket.create_connection((self.host, self.port), timeout=4.0)
            self.sock.settimeout(0.05)
            key = base64.b64encode(os.urandom(16)).decode()
            req = (
                f"GET / HTTP/1.1\r\nHost: {self.host}:{self.port}\r\n"
                "Upgrade: websocket\r\nConnection: Upgrade\r\n"
                f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n"
                "X-SetMix-Client: unreal\r\n\r\n"
            )
            self.sock.sendall(req.encode())
            deadline = time.time() + 4.0
            resp = b""
            while b"\r\n\r\n" not in resp and time.time() < deadline:
                try:
                    chunk = self.sock.recv(4096)
                    if not chunk:
                        break
                    resp += chunk
                except socket.timeout:
                    continue
            if b"101" not in resp.split(b"\r\n")[0]:
                self.close()
                return False
            accept = base64.b64encode(
                hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()
            ).decode()
            if accept.encode() not in resp:
                unreal.log_warning("[SetMix] accept key mismatch — continuing anyway")
            self.buf = resp.split(b"\r\n\r\n", 1)[1] if b"\r\n\r\n" in resp else b""
            self.connected = True
            return True
        except Exception as exc:  # noqa: BLE001
            unreal.log_warning(f"[SetMix] connect failed: {exc}")
            self.close()
            return False

    def send(self, payload: bytes) -> None:
        """Client→server frames must be masked."""
        if not (self.sock and self.connected):
            return
        n = len(payload)
        if n < 126:
            head = struct.pack("!BB", 0x82, 0x80 | n)
        elif n < 65536:
            head = struct.pack("!BBH", 0x82, 0x80 | 126, n)
        else:
            head = struct.pack("!BBQ", 0x82, 0x80 | 127, n)
        mask = os.urandom(4)
        masked = bytes(b ^ mask[i & 3] for i, b in enumerate(payload))
        try:
            self.sock.sendall(head + mask + masked)
        except Exception:  # noqa: BLE001
            self.connected = False

    def poll(self) -> list[bytes]:
        """Non-blocking-ish read; returns zero or more complete payloads."""
        out: list[bytes] = []
        if not (self.sock and self.connected):
            return out
        try:
            chunk = self.sock.recv(1 << 16)
            if chunk:
                self.buf += chunk
            elif chunk == b"":
                self.connected = False
                return out
        except socket.timeout:
            pass
        except Exception:  # noqa: BLE001
            self.connected = False
            return out

        while len(self.buf) >= 2:
            b1, b2 = self.buf[0], self.buf[1]
            masked = bool(b2 & 0x80)
            ln = b2 & 0x7F
            o = 2
            if ln == 126:
                if len(self.buf) < 4:
                    break
                ln = struct.unpack("!H", self.buf[2:4])[0]
                o = 4
            elif ln == 127:
                if len(self.buf) < 10:
                    break
                ln = struct.unpack("!Q", self.buf[2:10])[0]
                o = 10
            mlen = 4 if masked else 0
            if len(self.buf) < o + mlen + ln:
                break
            mask = self.buf[o:o + mlen]
            data = self.buf[o + mlen:o + mlen + ln]
            if masked:
                data = bytes(b ^ mask[i & 3] for i, b in enumerate(data))
            self.buf = self.buf[o + mlen + ln:]
            opcode = b1 & 0x0F
            if opcode == 0x8:          # close
                self.connected = False
            elif opcode in (0x1, 0x2):  # text / binary
                out.append(data)
        return out

    def close(self) -> None:
        self.connected = False
        if self.sock:
            try:
                self.sock.close()
            except Exception:  # noqa: BLE001
                pass
        self.sock = None


# ───────────────────────────────────────────────── the live-link session ──

class SetmixLiveLink:
    """Owns the socket thread, the inbound queue, and the editor-side mirror."""

    def __init__(self) -> None:
        self.ws = WSClient()
        self.queue: Deque[Tuple[int, int, bytes]] = deque(maxlen=4096)
        self.lock = threading.Lock()
        self.thread: Optional[threading.Thread] = None
        self.running = False
        self.tick_handle = None

        self.fidelity = (0.0, 0.0, 0.0, 0.0)
        self.frames = 0
        self.applied = 0
        self.coalesced = 0
        self.last_log = 0.0

        # cached editor objects, resolved lazily so a cold project still loads
        self._rover: Optional[Any] = None
        self._avatar: Optional[Any] = None
        self._landscape_mid: Optional[Any] = None
        self._materials: Dict[str, Any] = {}

    # ── lifecycle ─────────────────────────────────────────────────────
    def start(self) -> None:
        if self.running:
            unreal.log("[SetMix] already connected")
            return
        if not self.ws.connect():
            unreal.log_error("[SetMix] could not reach ws://localhost:8787 — "
                             "is `bun run scripts/ue5-bridge.ts` running?")
            return
        self.running = True
        self.thread = threading.Thread(target=self._pump, daemon=True, name="SetMixLiveLink")
        self.thread.start()
        # Slate tick runs on the game thread: the ONLY place unreal.* is legal
        self.tick_handle = unreal.register_slate_post_tick_callback(self._drain)
        self.ws.send(encode(OP_HELLO, 0, json.dumps(
            {"client": "unreal", "version": unreal.SystemLibrary.get_engine_version()}
        ).encode()))
        self.ws.send(encode(OP_RESYNC, 0, b""))
        unreal.log("[SetMix] live link CONNECTED — mirroring at 120 Hz")

    def stop(self) -> None:
        self.running = False
        if self.tick_handle is not None:
            unreal.unregister_slate_post_tick_callback(self.tick_handle)
            self.tick_handle = None
        self.ws.close()
        unreal.log(f"[SetMix] disconnected · {self.applied} edits applied, "
                   f"{self.coalesced} transforms coalesced")

    # ── worker thread: socket only, never touches unreal.* ────────────
    def _pump(self) -> None:
        while self.running and self.ws.connected:
            for raw in self.ws.poll():
                msg = decode(raw)
                if not msg:
                    continue
                op, tick, _flags, payload = msg
                with self.lock:
                    self.queue.append((op, tick, payload))
            time.sleep(0.002)
        self.running = False

    # ── game thread: drain and apply ──────────────────────────────────
    def _drain(self, _delta: float) -> None:
        with self.lock:
            batch = list(self.queue)
            self.queue.clear()

        # Coalesce transform ops to the LAST of each per drain. At 120 Hz in
        # and ~60 Hz out we would otherwise set the same actor twice a frame
        # for no visible gain and measurable game-thread cost.
        latest: Dict[int, bytes] = {}
        ordered: list[Tuple[int, int, bytes]] = []
        for op, tick, payload in batch:
            if op in (OP_ROVER, OP_AVATAR, OP_FIDELITY, OP_WAVE):
                if op in latest:
                    self.coalesced += 1
                latest[op] = payload
            else:
                ordered.append((op, tick, payload))

        for op, _tick, payload in ordered:
            self._apply(op, payload)
        for op, payload in latest.items():
            self._apply(op, payload)

        self.frames += 1
        now = time.time()
        if now - self.last_log > 10.0 and self.applied:
            self.last_log = now
            unreal.log(f"[SetMix] {self.applied} edits · {self.coalesced} coalesced · "
                       f"Fi {self.fidelity}")

    def _apply(self, op: int, payload: bytes) -> None:
        try:
            if op == OP_FIDELITY:
                self._on_fidelity(payload)
            elif op == OP_ROVER:
                self._on_transform(payload, "rover")
            elif op == OP_AVATAR:
                self._on_transform(payload, "avatar")
            elif op == OP_CARTRIDGE:
                self._on_cartridge(payload)
            elif op == OP_VARIABLE:
                self._on_variable(payload)
            elif op == OP_WAVE:
                self._on_wave(payload)
            elif op == OP_CHUNK_DELTA:
                self._on_chunk(payload)
            elif op == OP_MODE:
                self._on_mode(payload)
            self.applied += 1
        except Exception as exc:  # noqa: BLE001
            unreal.log_warning(f"[SetMix] {OP_NAMES.get(op, op)} failed: {exc}")

    # ── handlers ──────────────────────────────────────────────────────
    def _on_fidelity(self, p: bytes) -> None:
        """Four floats → every Substrate parameter that depends on them.
        This is deriveBudget(), mirrored: Pxd→texel/octaves, Vtx→relief,
        Lx→shading, Aq→wetness."""
        if len(p) < 16:
            return
        pxd, vtx, lx, aq = struct.unpack("<ffff", p[:16])
        self.fidelity = (pxd, vtx, lx, aq)

        def norm(v: float, target: float) -> float:
            return min(1.0, max(0.0, math.log1p(max(0.0, v)) / math.log1p(target))) ** 2.5

        n_pxd = norm(pxd, 1.24e8)
        n_vtx = norm(vtx, 9.4e7)
        n_lx = norm(lx, 6.6e7)
        n_aq = norm(aq, 4.1e7)

        mid = self._get_landscape_mid()
        if mid is None:
            return
        for name, value in (
            ("Fi_PixelDensity", n_pxd),
            ("Fi_GeometricFlux", n_vtx),
            ("Fi_Lumens", n_lx),
            ("Fi_Hydrology", n_aq),
            ("NormalIntensity", 0.15 + n_vtx * 1.55),
            ("WetnessMask", max(0.0, (n_aq - 0.22) / 0.78)),
            ("TriplanarSharpness", 2.0 + (0.15 + n_vtx * 1.55) * 3.0),
            ("PaletteLevels", -1.0 if n_pxd < 0.12 else (0.0 if n_pxd >= 0.72 else 6.0)),
            ("DisplacementScale", 8192.0 * (0.25 + n_vtx * 0.75)),
        ):
            unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(
                mid, name, float(value))
        unreal.MaterialEditingLibrary.update_material_instance(mid)

    def _on_transform(self, p: bytes, which: str) -> None:
        if len(p) < 24:
            return
        x, y, z, yaw, speed, drift = struct.unpack("<ffffff", p[:24])
        actor = self._get_rover() if which == "rover" else self._get_avatar()
        if actor is None:
            return
        # SetMix is Y-up metres; Unreal is Z-up centimetres.
        loc = unreal.Vector(x * M_TO_CM, z * M_TO_CM, y * M_TO_CM)
        rot = unreal.Rotator(0.0, math.degrees(yaw), math.degrees(drift) * 0.35)
        actor.set_actor_location_and_rotation(loc, rot, False, False)
        if which == "rover":
            # feed the speed/drift into the rover's own MID for wheel blur etc.
            for comp in actor.get_components_by_class(unreal.StaticMeshComponent):
                mid = comp.get_material(0)
                if isinstance(mid, unreal.MaterialInstanceDynamic):
                    mid.set_scalar_parameter_value("Speed", abs(speed))
                    mid.set_scalar_parameter_value("Drift", abs(drift))
                break

    def _on_cartridge(self, p: bytes) -> None:
        """A cartridge graph changed → rebuild its Substrate material instance.
        Graphs change on human timescales, so a full update here is free."""
        data = json.loads(p.decode("utf-8"))
        cart_id = data.get("id", "unknown")
        mi = self._ensure_material(cart_id)
        if mi is None:
            return
        for name, value in (data.get("scalars") or {}).items():
            unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(
                mi, name, float(value))
        for name, rgba in (data.get("vectors") or {}).items():
            unreal.MaterialEditingLibrary.set_material_instance_vector_parameter_value(
                mi, name, unreal.LinearColor(*[float(c) for c in rgba]))
        unreal.EditorAssetLibrary.set_metadata_tag(mi, "SetMix.Hash", str(data.get("hash", "")))
        unreal.MaterialEditingLibrary.update_material_instance(mi)
        unreal.log(f"[SetMix] cartridge '{cart_id}' → {mi.get_name()}")

    def _on_variable(self, p: bytes) -> None:
        """One VarDecl moved. Scalar poke only — never a recompile, so the
        artist can scrub a slider in the browser at 120 Hz and watch Lumen
        resolve it live."""
        data = json.loads(p.decode("utf-8"))
        mi = self._materials.get(data.get("cartridge", "")) or self._get_landscape_mid()
        if mi is None:
            return
        unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(
            mi, str(data["param"]), float(data["value"]))
        unreal.MaterialEditingLibrary.update_material_instance(mi)

    def _on_wave(self, p: bytes) -> None:
        """Terraform wave front → the landscape material's displacement mask.
        UE does the geomorph in WPO using the same C¹ smoothstep the browser
        uses, so the two viewports stay visually in lockstep."""
        if len(p) < 20:
            return
        ox, oz, radius, thickness, direction = struct.unpack("<fffff", p[:20])
        mid = self._get_landscape_mid()
        if mid is None:
            return
        unreal.MaterialEditingLibrary.set_material_instance_vector_parameter_value(
            mid, "WaveFront",
            unreal.LinearColor(ox * M_TO_CM, oz * M_TO_CM, radius * M_TO_CM, thickness * M_TO_CM))
        unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(
            mid, "WaveDirection", float(direction))
        unreal.MaterialEditingLibrary.update_material_instance(mid)

    def _on_chunk(self, p: bytes) -> None:
        """Sculpted SDF delta for one chunk → deform the procedural mesh.
        Only the touched chunk is rebuilt; everything else is untouched."""
        data = json.loads(p.decode("utf-8"))
        chunk_id = data.get("chunk", "?")
        actors = unreal.EditorLevelLibrary.get_all_level_actors()
        for a in actors:
            if a.get_actor_label() == f"SMX_Chunk_{chunk_id}":
                pmc = a.get_component_by_class(unreal.DynamicMeshComponent)
                if pmc:
                    a.set_editor_property("bNeedsRebuild", True)
                unreal.log(f"[SetMix] chunk {chunk_id} marked for rebuild")
                return

    def _on_mode(self, p: bytes) -> None:
        mode = p.decode("utf-8", errors="ignore") or "PLAY"
        unreal.log(f"[SetMix] browser mode → {mode}")

    # ── lazy editor lookups ───────────────────────────────────────────
    def _find_actor(self, label: str) -> Optional[Any]:
        for a in unreal.EditorLevelLibrary.get_all_level_actors():
            if a.get_actor_label() == label:
                return a
        return None

    def _get_rover(self) -> Optional[Any]:
        if self._rover is None or not unreal.SystemLibrary.is_valid(self._rover):
            self._rover = self._find_actor("SMX_Rover")
            if self._rover is None:
                self._rover = unreal.EditorLevelLibrary.spawn_actor_from_class(
                    unreal.StaticMeshActor, unreal.Vector(0, 0, 0))
                self._rover.set_actor_label("SMX_Rover")
                unreal.log("[SetMix] spawned SMX_Rover")
        return self._rover

    def _get_avatar(self) -> Optional[Any]:
        if self._avatar is None or not unreal.SystemLibrary.is_valid(self._avatar):
            self._avatar = self._find_actor("SMX_Goblin")
            if self._avatar is None:
                self._avatar = unreal.EditorLevelLibrary.spawn_actor_from_class(
                    unreal.StaticMeshActor, unreal.Vector(0, 0, 0))
                self._avatar.set_actor_label("SMX_Goblin")
        return self._avatar

    def _get_landscape_mid(self) -> Optional[Any]:
        if self._landscape_mid is None:
            self._landscape_mid = self._ensure_material("landscape")
        return self._landscape_mid

    def _ensure_material(self, key: str) -> Optional[Any]:
        if key in self._materials:
            return self._materials[key]
        path = f"{CONTENT_ROOT}/MI_SMX_{key}"
        mi = unreal.EditorAssetLibrary.load_asset(path)
        if mi is None:
            parent = unreal.EditorAssetLibrary.load_asset(MASTER_MATERIAL)
            if parent is None:
                unreal.log_error(f"[SetMix] master material missing: {MASTER_MATERIAL}")
                return None
            if not unreal.EditorAssetLibrary.does_directory_exist(CONTENT_ROOT):
                unreal.EditorAssetLibrary.make_directory(CONTENT_ROOT)
            mi = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
                asset_name=f"MI_SMX_{key}", package_path=CONTENT_ROOT,
                asset_class=unreal.MaterialInstanceConstant,
                factory=unreal.MaterialInstanceConstantFactoryNew())
            unreal.MaterialEditingLibrary.set_material_instance_parent(mi, parent)
            unreal.log(f"[SetMix] created {path}")
        self._materials[key] = mi
        return mi


# ────────────────────────────────────────────────────── editor toolbar ──

_SESSION: Optional[SetmixLiveLink] = None


def _session() -> SetmixLiveLink:
    global _SESSION
    if _SESSION is None:
        _SESSION = SetmixLiveLink()
    return _SESSION


@unreal.uclass()
class SetmixConnectEntry(unreal.ToolMenuEntryScript):
    @unreal.ufunction(override=True)
    def execute(self, context):  # noqa: ANN001, D102
        _session().start()


@unreal.uclass()
class SetmixDisconnectEntry(unreal.ToolMenuEntryScript):
    @unreal.ufunction(override=True)
    def execute(self, context):  # noqa: ANN001, D102
        _session().stop()


def register_menu() -> None:
    menus = unreal.ToolMenus.get()
    main = menus.find_menu("LevelEditor.MainMenu")
    if main is None:
        unreal.log_warning("[SetMix] main menu unavailable")
        return
    menu = main.add_sub_menu("LevelEditor.MainMenu", "SetMix", "SetMix", "SetMix")

    for cls, name, label, tip in (
        (SetmixConnectEntry, "SetmixConnect", "Connect Live Link",
         "Mirror the browser runtime into this viewport at 120 Hz"),
        (SetmixDisconnectEntry, "SetmixDisconnect", "Disconnect",
         "Stop mirroring"),
    ):
        entry = cls()
        entry.init_entry(
            owner_name=menu.menu_name, menu=menu.menu_name, section="SetMix",
            name=name, label=label, tool_tip=tip,
        )
        entry.register_menu_entry()

    menus.refresh_all_widgets()
    unreal.log("[SetMix] toolbar registered — SetMix ▸ Connect Live Link")


if __name__ == "__main__":
    register_menu()
