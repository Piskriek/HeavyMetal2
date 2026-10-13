/**
 * The Studio's viewport: a three.js scene with one or more copies of an asset (the levels side by side, or the old and
 * the new model), a ground grid, a 1.8 m figure for scale, the camera in the chosen keymap, and the move / rotate /
 * scale gizmo on one anchor copy. The gizmo's maths is @hm/gizmo (hit test, drag, snapping); this file draws it and turns
 * the pointer into rays. Edits leave through the hooks; the viewport never changes the document itself.
 */
import * as THREE from 'three';
import { drag, hitTest, worldLength, type DragResult, type GizmoMode, type Handle, type Ray, type Vec3 } from '@hm/gizmo';
import { applyAssetTweak } from '../assets/gen';
import type { AssetTweak } from '../../studio-server/tweak-schema';

export type Keymap = 'setmix' | 'blender' | 'maya';
export type Tool = GizmoMode;
export type Overlay = 'solid' | 'wire' | 'normals';
/** What the asset sits in: nothing, a 4 m floor grid, a wall behind it, or its lattice box on the grid. */
export type Context = 'none' | 'floor' | 'wall' | 'lattice';

/** The transform the gizmo edits: the asset's offset, its turn and its uniform scale. */
export interface Transform {
  readonly offset: Vec3;
  readonly yaw: number;
  readonly scale: number;
}

/** One copy of an asset in the scene: a level, or the old or new model. Its origin sits at `slot`. */
export interface Copy {
  readonly key: string;
  readonly label: string;
  /** The asset as its file has it. Never changed: the viewport clones it. */
  readonly raw: THREE.Group;
  readonly slot: Vec3;
  /** The saved or unsaved tweak applied to this copy (null for an archived model, which is shown as it was). */
  readonly tweak: AssetTweak | null;
}

export interface ShowOptions {
  /** The copy that carries the gizmo (its slot plus the offset is the pivot), or null for no gizmo. */
  readonly anchor: number | null;
  readonly transform: Transform | null;
  readonly overlay: Overlay;
  readonly figure: boolean;
  readonly context: Context;
  /** Real size in metres, from the registry: spacing, the wall and the figure's place. */
  readonly size: readonly [number, number, number];
  /** A lattice piece's box, in the asset's own frame (its context draws it). */
  readonly box?: readonly [readonly [number, number, number], readonly [number, number, number]];
  /** Fit the camera to the copies. */
  readonly reframe: boolean;
}

export interface CopyStats { readonly key: string; readonly meshes: number; readonly triangles: number }

export interface ViewportHooks {
  readonly onDragStart: () => void;
  readonly onDrag: (next: Partial<Transform>) => void;
  readonly onDragEnd: () => void;
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
/** The figure: a 1.8 m capsule (radius 0.22 m, straight part 1.36 m, the caps add 0.44 m). */
const FIGURE = { radius: 0.22, length: 1.36 };
const GRID_CELL = 4;

type Nav = { readonly kind: 'orbit' | 'pan' | 'zoom' | 'look'; x: number; y: number };

export class StudioViewport {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
  private readonly raycaster = new THREE.Raycaster();
  private readonly gizmo = new THREE.Group();
  private readonly copyRoot = new THREE.Group();
  private readonly contextRoot = new THREE.Group();
  private readonly figureRoot = new THREE.Group();
  private readonly normalMat = new THREE.MeshNormalMaterial();
  private readonly tags: HTMLDivElement;
  private readonly keys = new Set<string>();
  private readonly ro: ResizeObserver;
  private frame = 0;
  private last = performance.now();
  private nav: Nav | null = null;
  private tool: Tool = 'move';
  private keymap: Keymap = 'setmix';
  private transform: Transform | null = null;
  private anchorBase: Vec3 | null = null;
  private overlay: Overlay = 'solid';
  private tagItems: { el: HTMLSpanElement; at: THREE.Vector3 }[] = [];
  private held: { handle: Handle; start: Ray; from: Transform; len: number; pivot: Vec3 } | null = null;
  // orbit state: where the camera looks from and at
  private yaw = 0.7;
  private pitch = 0.42;
  private dist = 7;
  private readonly target = new THREE.Vector3(0, 0.8, 0);
  private solidMats: THREE.Material[] = [];

  constructor(private readonly host: HTMLElement, private readonly hooks: ViewportHooks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
    this.renderer.setClearColor(0x080b10, 1);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'sx-canvas';
    this.tags = document.createElement('div');
    this.tags.className = 'sx-tags';
    this.tags.setAttribute('aria-hidden', 'true');
    host.appendChild(this.tags);

    this.scene.add(new THREE.HemisphereLight(0xd6ecff, 0x18120a, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(4, 9, 6);
    this.scene.add(sun);
    const grid = new THREE.GridHelper(40, 40, 0x2b3d50, 0x141e2a);
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);
    this.scene.add(this.contextRoot, this.copyRoot, this.figureRoot);
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

  /**
   * Shows the copies of one asset. Each copy is cloned from its raw asset and tweaked on its own clone; the copies share
   * geometry with the cache, so nothing the game uses is changed. Returns each copy's mesh and triangle counts.
   */
  show(copies: readonly Copy[], opts: ShowOptions): CopyStats[] {
    this.clearCopies();
    this.overlay = opts.overlay;
    this.transform = opts.transform;
    const stats: CopyStats[] = [];
    const top = opts.size[1] + 0.2;
    copies.forEach((c, i) => {
      const inst = applyAssetTweak(c.raw.clone(true), c.tweak ?? undefined);
      // a tweak made fresh clones of the materials: those originals are not the cache's, so they are freed here
      const tuned = c.tweak !== null && (['tint', 'metalness', 'roughness', 'emissive', 'emissiveIntensity'] as const).some((k) => c.tweak?.[k] !== undefined);
      // every mesh gets its own material, so an overlay changes this copy and no other, and the cache stays as it is
      let meshes = 0, triangles = 0;
      inst.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const original = m.material;
        const solid = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
        if (tuned) (Array.isArray(original) ? original : [original]).forEach((x) => x.dispose());
        m.userData.solid = solid;
        this.solidMats.push(...(Array.isArray(solid) ? solid : [solid]));
        meshes++;
        const idx = m.geometry.index;
        triangles += idx ? idx.count / 3 : (m.geometry.getAttribute('position')?.count ?? 0) / 3;
      });
      const g = new THREE.Group();
      g.position.set(c.slot[0], c.slot[1], c.slot[2]);
      g.add(inst);
      this.copyRoot.add(g);
      stats.push({ key: c.key, meshes, triangles: Math.round(triangles) });
      const el = document.createElement('span');
      el.className = 'sx-world-tag';
      el.textContent = c.label;
      el.dataset.index = String(i);
      this.tags.appendChild(el);
      this.tagItems.push({ el, at: new THREE.Vector3(c.slot[0], top, c.slot[2]) });
    });
    this.applyOverlay(this.overlay);
    if (opts.figure && copies.length > 0) this.drawFigure(copies, opts.size);
    this.drawContext(copies, opts);
    if (opts.anchor !== null && copies[opts.anchor]) {
      const s = copies[opts.anchor]!.slot;
      this.anchorBase = [s[0], s[1], s[2]];
    } else {
      this.anchorBase = null;
    }
    if (opts.reframe) this.fitTo(copies);
    this.drawGizmo();
    return stats;
  }

  /** Changes the overlay on what is shown: the solid model, its wireframe, or its normals. */
  setOverlay(o: Overlay): void {
    this.overlay = o;
    this.applyOverlay(o);
  }

  /** Frames the copies (or the gizmo pivot) from the current angle. */
  focus(): void {
    const p = this.pivot() ?? [0, 0.8, 0];
    this.target.set(p[0], p[1], p[2]);
    this.dist = 6;
  }

  dispose(): void {
    this.ro.disconnect();
    this.clearCopies();
    this.normalMat.dispose();
    this.renderer.dispose();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.remove();
    this.tags.remove();
    cancelAnimationFrame(this.frame);
  }

  // ---- what is shown ----

  private clearCopies(): void {
    for (const c of [...this.copyRoot.children]) { this.copyRoot.remove(c); }
    for (const c of [...this.contextRoot.children]) { this.contextRoot.remove(c); disposeTree(c); }
    for (const c of [...this.figureRoot.children]) { this.figureRoot.remove(c); disposeTree(c); }
    for (const m of this.solidMats) m.dispose();
    this.solidMats = [];
    this.tags.replaceChildren();
    this.tagItems = [];
  }

  /** The solid, wire or normal look on every mesh of every copy. */
  private applyOverlay(o: Overlay): void {
    this.copyRoot.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh || !m.userData.solid) return;
      const solid = m.userData.solid as THREE.Material | THREE.Material[];
      const list = Array.isArray(solid) ? solid : [solid];
      for (const mat of list) (mat as THREE.Material & { wireframe?: boolean }).wireframe = o === 'wire';
      if (o === 'normals') m.material = this.normalMat;
      else m.material = solid;
    });
  }

  private drawFigure(copies: readonly Copy[], size: readonly [number, number, number]): void {
    const minX = Math.min(...copies.map((c) => c.slot[0])) - Math.max(size[0], size[2]) / 2 - 0.9;
    const cap = new THREE.Mesh(
      new THREE.CapsuleGeometry(FIGURE.radius, FIGURE.length, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0x8aa0b4, roughness: 0.7, metalness: 0 }),
    );
    cap.position.set(minX, 0.9, 0);
    this.figureRoot.add(cap);
    const el = document.createElement('span');
    el.className = 'sx-world-tag sx-world-figure';
    el.textContent = '1.8 m';
    this.tags.appendChild(el);
    this.tagItems.push({ el, at: new THREE.Vector3(minX, 1.9, 0) });
  }

  /** The asset in its place: a 4 m floor grid, a wall behind it, or its lattice box on the grid. */
  private drawContext(copies: readonly Copy[], opts: ShowOptions): void {
    if (opts.context === 'none' || copies.length === 0) return;
    const xs = copies.map((c) => c.slot[0]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    // whole 4 m cells, enough to hold every copy and a margin
    const cells = Math.max(1, Math.ceil((Math.max(...xs) - Math.min(...xs) + Math.max(opts.size[0], opts.size[2]) + 1) / GRID_CELL));
    const span = cells * GRID_CELL;
    const grid = new THREE.GridHelper(span, cells, 0x5fd4ff, 0x1d3445);
    grid.position.set(cx, 0.002, 0);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.7;
    this.contextRoot.add(grid);
    if (opts.context === 'wall') {
      const w = span;
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(w, 3),
        new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.9, side: THREE.DoubleSide }),
      );
      wall.position.set(cx, 1.5, -opts.size[2] / 2 - 0.06);
      this.contextRoot.add(wall);
    }
    if (opts.context === 'lattice' && opts.box) {
      const [lo, hi] = opts.box;
      const w = hi[0] - lo[0], h = hi[1] - lo[1], d = hi[2] - lo[2];
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
        new THREE.LineBasicMaterial({ color: 0xffc53d, transparent: true, opacity: 0.8 }),
      );
      // the copies sit at their slots, so the box is drawn at each copy's slot
      for (const c of copies) {
        const e = edges.clone();
        e.position.set(c.slot[0] + (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2 + c.slot[1], c.slot[2] + (lo[2] + hi[2]) / 2);
        this.contextRoot.add(e);
      }
    }
  }

  /** Frames the copies: centre on their bounds, back off far enough to see all of them. */
  private fitTo(copies: readonly Copy[]): void {
    if (copies.length === 0) return;
    const box = new THREE.Box3().setFromObject(this.copyRoot);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    this.target.copy(c);
    this.dist = Math.min(60, Math.max(2.5, Math.max(s.x, s.y * 1.2, s.z) * 1.35 + 1.2));
  }

  /** The gizmo's pivot in the scene: the anchor copy's slot plus the offset, or null when there is no gizmo. */
  private pivot(): Vec3 | null {
    if (!this.transform || !this.anchorBase) return null;
    const o = this.transform.offset, b = this.anchorBase;
    return [b[0] + o[0], b[1] + o[1], b[2] + o[2]];
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
    const p = this.pivot();
    if (p) this.gizmo.scale.setScalar(this.gizmoLength(p));
    this.renderer.render(this.scene, this.camera);
    this.placeTags();
  };

  /** The labels sit above their copies: each frame they are projected from the scene onto the view. */
  private placeTags(): void {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    for (const t of this.tagItems) {
      const v = t.at.clone().project(this.camera);
      const visible = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      t.el.style.opacity = visible ? '1' : '0';
      t.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
    }
  }

  // ---- gizmo drawing ----

  private drawGizmo(): void {
    for (const c of [...this.gizmo.children]) { this.gizmo.remove(c); disposeTree(c); }
    const p = this.pivot();
    if (!p) return;
    this.gizmo.position.set(p[0], p[1], p[2]);
    const len = 1; // unit length; the group is scaled to the gizmo length every frame
    const mat = (c: number, opacity = 1): THREE.MeshBasicMaterial =>
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
    const pivot = this.pivot();
    if (e.button !== 0 || !this.transform || !pivot) return;
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
