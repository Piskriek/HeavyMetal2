/**
 * The Studio's viewport: a three.js scene with one asset, a ground grid, the camera in the chosen keymap, and the
 * move / rotate / scale gizmo. The gizmo's maths is @hm/gizmo (hit test, drag, snapping); this file only draws it and
 * turns the pointer into rays. Edits leave through the hooks; the viewport never changes the document itself.
 */
import * as THREE from 'three';
import { drag, hitTest, worldLength, type DragResult, type GizmoMode, type Handle, type Ray, type Vec3 } from '@hm/gizmo';
import { applyAssetTweak } from '../assets/gen';
import type { AssetTweak } from '../../studio-server/tweak-schema';

export type Keymap = 'setmix' | 'blender' | 'maya';
export type Tool = GizmoMode;

/** The transform the gizmo edits: the asset's offset, its turn and its uniform scale. */
export interface Transform {
  readonly offset: Vec3;
  readonly yaw: number;
  readonly scale: number;
}

export interface ViewportHooks {
  readonly onDragStart: () => void;
  readonly onDrag: (next: Partial<Transform>) => void;
  readonly onDragEnd: () => void;
  readonly onStats: (stats: { readonly meshes: number; readonly triangles: number }) => void;
}

/** Keymaps: which keys pick a tool, and how the mouse moves the camera. Maya is also the default for W/E/R. */
export const KEYMAPS: Readonly<Record<Keymap, { readonly label: string; readonly tools: Readonly<Record<string, Tool>>; readonly nav: string }>> = {
  setmix: { label: 'SetMix', tools: { w: 'move', e: 'rotate', r: 'scale' }, nav: 'Right button and WASD fly; wheel zooms' },
  blender: { label: 'Blender', tools: { g: 'move', r: 'rotate', s: 'scale' }, nav: 'Middle button orbits; Shift and middle pans' },
  maya: { label: 'Maya', tools: { w: 'move', e: 'rotate', r: 'scale' }, nav: 'Alt and left orbits; Alt and middle pans; Alt and right zooms' },
};

const COLOUR = { x: 0xe5484d, y: 0x46a758, z: 0x3e63dd, uniform: 0xf4f4f5 } as const;
/** The gizmo is drawn at unit length and scaled each frame so it keeps a steady size on screen (@hm/gizmo's worldLength). */
const GIZMO_SCALE = 1.6;

type Nav = { readonly kind: 'orbit' | 'pan' | 'zoom' | 'look'; x: number; y: number };

export class StudioViewport {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
  private readonly raycaster = new THREE.Raycaster();
  private readonly gizmo = new THREE.Group();
  private model: THREE.Group | null = null;
  private readonly keys = new Set<string>();
  private readonly ro: ResizeObserver;
  private frame = 0;
  private last = performance.now();
  private nav: Nav | null = null;
  private tool: Tool = 'move';
  private keymap: Keymap = 'setmix';
  private transform: Transform | null = null;
  private held: { handle: Handle; start: Ray; from: Transform; len: number; pivot: Vec3 } | null = null;
  // orbit state: where the camera looks from and at
  private yaw = 0.7;
  private pitch = 0.42;
  private dist = 7;
  private readonly target = new THREE.Vector3(0, 0.8, 0);

  constructor(private readonly host: HTMLElement, private readonly hooks: ViewportHooks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
    this.renderer.setClearColor(0x080b10, 1);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'sx-canvas';

    this.scene.add(new THREE.HemisphereLight(0xd6ecff, 0x18120a, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(4, 9, 6);
    this.scene.add(sun);
    const grid = new THREE.GridHelper(40, 40, 0x2b3d50, 0x141e2a);
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);
    this.gizmo.renderOrder = 10;
    this.scene.add(this.gizmo);

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop();
  }

  setKeymap(k: Keymap): void { this.keymap = k; }
  setTool(t: Tool): void { this.tool = t; this.drawGizmo(); }
  get currentTool(): Tool { return this.tool; }
  toolForKey(key: string): Tool | null { return KEYMAPS[this.keymap].tools[key.toLowerCase()] ?? null; }

  /** Shows one asset with its (unsaved or saved) transform. `raw` is the asset as its file has it. */
  show(raw: THREE.Group | null, tweak: AssetTweak | null, transform: Transform | null): void {
    if (this.model) this.scene.remove(this.model);
    this.model = null;
    this.transform = transform;
    if (raw) {
      const inst = applyAssetTweak(raw.clone(true), tweak ?? undefined);
      this.model = inst;
      this.scene.add(inst);
      let meshes = 0, triangles = 0;
      inst.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        meshes++;
        const idx = m.geometry.index;
        triangles += idx ? idx.count / 3 : (m.geometry.getAttribute('position')?.count ?? 0) / 3;
      });
      this.hooks.onStats({ meshes, triangles: Math.round(triangles) });
    } else {
      this.hooks.onStats({ meshes: 0, triangles: 0 });
    }
    this.drawGizmo();
  }

  /** Frames the asset (or the gizmo pivot) from the current angle. */
  focus(): void {
    const p: Vec3 = this.transform ? this.transform.offset : [0, 0.8, 0];
    this.target.set(p[0], p[1], p[2]);
    this.dist = 6;
  }

  dispose(): void {
    this.ro.disconnect();
    this.renderer.dispose();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.remove();
    cancelAnimationFrame(this.frame);
  }

  // ---- camera ----

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private placeCamera(): void {
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + this.dist * cp * Math.sin(this.yaw),
      this.target.y + this.dist * Math.sin(this.pitch),
      this.target.z + this.dist * cp * Math.cos(this.yaw),
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    // WASD flies only while the right button looks round (SetMix); otherwise those keys are not ours
    if (this.nav?.kind === 'look' && this.keys.size > 0) {
      const sp = dt * this.dist * 0.9;
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      let mx = 0, mz = 0;
      if (this.keys.has('w')) { mx += fx; mz += fz; }
      if (this.keys.has('s')) { mx -= fx; mz -= fz; }
      if (this.keys.has('d')) { mx += rx; mz += rz; }
      if (this.keys.has('a')) { mx -= rx; mz -= rz; }
      this.target.x += mx * sp;
      this.target.z += mz * sp;
    }
    this.placeCamera();
    if (this.transform) this.gizmo.scale.setScalar(this.gizmoLength(this.transform.offset));
    this.renderer.render(this.scene, this.camera);
  };

  // ---- gizmo drawing ----

  private drawGizmo(): void {
    for (const c of [...this.gizmo.children]) { this.gizmo.remove(c); disposeTree(c); }
    if (!this.transform) return;
    const p = this.transform.offset;
    this.gizmo.position.set(p[0], p[1], p[2]);
    const len = 1; // unit length; the group is scaled to the gizmo length every frame
    const mat =(c: number, opacity = 1): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: opacity < 1, opacity, depthWrite: false });
    if (this.tool === 'move') {
      for (const k of ['x', 'y', 'z'] as const) {
        const g = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * len, 0.03 * len, 0.7 * len, 8), mat(COLOUR[k]));
        shaft.position.y = 0.35 * len;
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08 * len, 0.25 * len, 12), mat(COLOUR[k]));
        tip.position.y = 0.85 * len;
        g.add(shaft, tip);
        if (k === 'x') g.rotation.z = -Math.PI / 2;
        if (k === 'z') g.rotation.x = Math.PI / 2;
        this.gizmo.add(g);
      }
      for (const [a, b] of [['x', 'y'], ['x', 'z'], ['y', 'z']] as const) {
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.25 * len, 0.25 * len), mat(0xffffff, 0.35));
        const third = (['x', 'y', 'z'] as const).find((k) => k !== a && k !== b) ?? 'y';
        plane.material = mat(COLOUR[third], 0.45);
        const off = 0.3 * len;
        const pos: Record<'x' | 'y' | 'z', number> = { x: 0, y: 0, z: 0 };
        pos[a] = off; pos[b] = off;
        plane.position.set(pos.x, pos.y, pos.z);
        if (third === 'x') plane.rotation.y = Math.PI / 2;
        if (third === 'y') plane.rotation.x = -Math.PI / 2;
        this.gizmo.add(plane);
      }
    } else if (this.tool === 'rotate') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(len, 0.035 * len, 8, 80), mat(COLOUR.y));
      ring.rotation.x = Math.PI / 2;
      this.gizmo.add(ring);
    } else {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.2 * len, 0.2 * len, 0.2 * len), mat(COLOUR.uniform));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4 * len, 0.02 * len, 8, 64), mat(COLOUR.uniform, 0.8));
      ring.rotation.x = Math.PI / 2;
      this.gizmo.add(cube, ring);
    }
  }

  /** The gizmo's arrow length in metres for this camera distance: the length the hit test and the drag both use. */
  private gizmoLength(pivot: Vec3): number {
    const cam = this.camera.position;
    return worldLength(pivot, [cam.x, cam.y, cam.z], this.camera.fov, GIZMO_SCALE);
  }

  // ---- pointer ----

  private rayAt(e: PointerEvent): Ray {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const o = this.raycaster.ray.origin, d = this.raycaster.ray.direction;
    return { origin: [o.x, o.y, o.z], dir: [d.x, d.y, d.z] };
  }

  private navKind(e: PointerEvent): Nav['kind'] | null {
    const b = e.button, alt = e.altKey;
    if (this.keymap === 'setmix') return b === 2 ? 'look' : b === 1 ? 'pan' : null;
    if (this.keymap === 'blender') return b === 1 ? (e.shiftKey ? 'pan' : 'orbit') : null;
    if (!alt) return null;
    return b === 0 ? 'orbit' : b === 1 ? 'pan' : b === 2 ? 'zoom' : null;
  }

  private onDown = (e: PointerEvent): void => {
    const kind = this.navKind(e);
    if (kind) {
      this.nav = { kind, x: e.clientX, y: e.clientY };
      this.renderer.domElement.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (e.button !== 0 || !this.transform) return;
    const pivot: Vec3 = this.transform.offset;
    const ray = this.rayAt(e);
    const len = this.gizmoLength(pivot);
    const mode = this.tool;
    const handle = allowedHit(mode, hitTest({ mode, pivot }, ray, len));
    if (!handle) return;
    this.held = { handle, start: ray, from: this.transform, len, pivot };
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.hooks.onDragStart();
    e.preventDefault();
  };

  private onMove = (e: PointerEvent): void => {
    if (this.nav) {
      const dx = e.clientX - this.nav.x, dy = e.clientY - this.nav.y;
      this.nav.x = e.clientX; this.nav.y = e.clientY;
      if (this.nav.kind === 'orbit' || this.nav.kind === 'look') {
        this.yaw -= dx * 0.006;
        this.pitch = Math.min(1.45, Math.max(-0.2, this.pitch + dy * 0.005));
      } else if (this.nav.kind === 'pan') {
        this.placeCamera();
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
        const k = this.dist * 0.0016;
        this.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
      } else {
        this.dist = Math.min(60, Math.max(0.6, this.dist * Math.exp(dy * 0.006)));
      }
      return;
    }
    if (!this.held) return;
    const h = this.held;
    const shift = e.shiftKey, ctrl = e.ctrlKey || e.metaKey;
    const r: DragResult = drag({ mode: this.tool, pivot: h.pivot }, h.handle, h.start, this.rayAt(e), h.len, {
      ...(shift ? { move: 0.05 } : {}),
      ...(ctrl ? { turn: 15 } : {}),
    });
    this.hooks.onDrag(proposal(this.tool, h.from, r));
  };

  private onUp = (e: PointerEvent): void => {
    if (this.nav) { this.nav = null; this.keys.clear(); this.renderer.domElement.releasePointerCapture(e.pointerId); return; }
    if (this.held) { this.held = null; this.renderer.domElement.releasePointerCapture(e.pointerId); this.hooks.onDragEnd(); }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.dist = Math.min(60, Math.max(0.6, this.dist * Math.exp(e.deltaY * 0.0012)));
  };

  private onKey = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (isTyping(e.target)) return;
    if (this.nav?.kind === 'look' && ['w', 'a', 's', 'd'].includes(k)) { this.keys.add(k); e.preventDefault(); }
  };

  private onKeyUp = (e: KeyboardEvent): void => { this.keys.delete(e.key.toLowerCase()); };
}

/** The Handle the tool can follow, or null: move takes arrows and planes, rotate the up ring, scale the centre handle. */
function allowedHit(mode: Tool, h: Handle | null): Handle | null {
  if (!h) return null;
  if (mode === 'move') return h.kind === 'axis' || h.kind === 'plane' ? h : null;
  if (mode === 'rotate') return h.kind === 'ring' && h.axis === 'y' ? h : null;
  return h.kind === 'uniform' ? h : null;
}

/** The transform a drag gives: moved, turned or scaled from where it started. */
function proposal(mode: Tool, from: Transform, r: DragResult): Partial<Transform> {
  if (mode === 'move') {
    return { offset: [from.offset[0] + r.translate[0], from.offset[1] + r.translate[1], from.offset[2] + r.translate[2]] };
  }
  if (mode === 'rotate') {
    const deg = r.rotateAxis ? r.rotateAxis[1] * r.rotateDeg : 0;
    return { yaw: wrapDeg(from.yaw + deg) };
  }
  return { scale: clamp(from.scale * r.scale[0], 0.05, 5) };
}

const wrapDeg = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function disposeTree(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    m.geometry?.dispose();
    const mm = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
    else mm?.dispose();
  });
}
