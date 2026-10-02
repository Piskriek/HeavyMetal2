// uistack.ts — the navigation brain of a studio app where everything is a preset nested in a
// preset (universe > galaxy > sun system > planet > cube > model > faces > vertices > raw values).
// Pure, deterministic TypeScript: no DOM, no Date, no Math.random, no imports.

/* ------------------------------ shared helpers ------------------------------ */

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp = (v: number, lo: number, hi: number): number => (hi < lo ? lo : Math.min(Math.max(v, lo), hi));
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/* -------------------------- 1. HIERARCHY NAVIGATION ------------------------- */

export type NodeId = string;
export type MoveDirection = 'in' | 'out' | 'jump';
export interface Move { from: NodeId; to: NodeId; direction: MoveDirection }
export type ZoomOutResult = 'moved' | 'at-top' | 'ask-upper';
export interface Crumb { id: NodeId; label: string }

/**
 * Walks the preset hierarchy. The current "scale" is the subtree under `root()`; zooming out of
 * the root asks for the next upper scale (see `setUpperScales`). Nothing here touches the DOM.
 */
export class Navigator {
  private readonly parentOf: (id: NodeId) => NodeId | null;
  private readonly childrenOf: (id: NodeId) => NodeId[];
  private rootId: NodeId;
  private cur: NodeId;
  private last: Move | null = null;
  private visited: NodeId[];
  private cursor = 0;
  private upper: NodeId[] = [];
  private pending: NodeId | null = null;

  constructor(
    parentOf: (id: NodeId) => NodeId | null,
    childrenOf: (id: NodeId) => NodeId[],
    rootId: NodeId,
    startId: NodeId,
  ) {
    this.parentOf = parentOf;
    this.childrenOf = childrenOf;
    this.rootId = rootId;
    this.cur = this.chainTo(startId) ? startId : rootId;
    this.visited = [this.cur];
  }

  /** Ancestor chain root..id, or null when `id` is not inside the current scale. */
  private chainTo(id: NodeId): NodeId[] | null {
    const chain: NodeId[] = [];
    const seen = new Set<NodeId>();
    let node: NodeId | null = id;
    while (node !== null && !seen.has(node) && chain.length < 10_000) {
      chain.push(node);
      seen.add(node);
      if (node === this.rootId) return chain.reverse();
      node = this.parentOf(node);
    }
    return null;
  }

  current(): NodeId { return this.cur; }
  root(): NodeId { return this.rootId; }
  /** root..current */
  path(): NodeId[] { return this.chainTo(this.cur) ?? [this.cur]; }
  depth(): number { return this.path().length - 1; }
  breadcrumb(label: (id: NodeId) => string): Crumb[] {
    return this.path().map((id) => ({ id, label: label(id) }));
  }
  children(): NodeId[] { return this.childrenOf(this.cur).slice(); }
  canZoomIn(id: NodeId): boolean { return this.childrenOf(this.cur).includes(id); }
  /** No children = RAW level: the gear icon edits the raw value. */
  isLeaf(id: NodeId): boolean { return this.childrenOf(id).length === 0; }
  /** Transition record for animation. */
  lastMove(): Move | null { return this.last; }

  zoomIn(childId: NodeId): boolean {
    if (!this.canZoomIn(childId)) return false;
    this.go(childId, 'in');
    return true;
  }

  zoomOut(): ZoomOutResult {
    if (this.cur !== this.rootId) {
      const parent = this.parentOf(this.cur);
      if (parent !== null) {
        this.go(parent, 'out');
        return 'moved';
      }
    }
    const next = this.upper[0];
    if (next === undefined) {
      this.pending = null;
      return 'at-top';
    }
    this.pending = next;
    return 'ask-upper';
  }

  /** Any node of the current scale; the path is rebuilt through its ancestors. */
  zoomTo(id: NodeId): boolean {
    if (this.chainTo(id) === null) return false;
    if (id !== this.cur) this.go(id, 'jump');
    return true;
  }

  /** Bigger scales, nearest first (e.g. system, galaxy, universe). */
  setUpperScales(ids: NodeId[]): void {
    this.upper = ids.slice();
    this.pending = null;
  }
  upperScales(): NodeId[] { return this.upper.slice(); }
  pendingUpper(): NodeId | null { return this.pending; }
  confirmUpper(): boolean {
    const next = this.pending;
    if (next === null) return false;
    this.upper = this.upper.slice(this.upper.indexOf(next) + 1);
    this.rootId = next;
    this.go(next, 'out');
    return true;
  }
  declineUpper(): void { this.pending = null; }

  history(): NodeId[] { return this.visited.slice(); }
  canBack(): boolean { return this.cursor > 0; }
  canForward(): boolean { return this.cursor < this.visited.length - 1; }
  back(): boolean { return this.step(-1); }
  forward(): boolean { return this.step(1); }

  private step(delta: -1 | 1): boolean {
    const target = this.visited[this.cursor + delta];
    if (target === undefined) return false;
    this.cursor += delta;
    this.last = { from: this.cur, to: target, direction: this.directionTo(target) };
    this.cur = target;
    this.pending = null;
    return true;
  }

  private directionTo(to: NodeId): MoveDirection {
    if (this.parentOf(to) === this.cur) return 'in';
    if (this.parentOf(this.cur) === to) return 'out';
    return 'jump';
  }

  private go(to: NodeId, direction: MoveDirection): void {
    this.last = { from: this.cur, to, direction };
    this.cur = to;
    this.pending = null;
    this.visited.length = this.cursor + 1;
    this.visited.push(to);
    this.cursor = this.visited.length - 1;
  }
}

/* ------------------------------- 2. ESC LAYERS ------------------------------ */

export type Layer = 'dialog' | 'floating' | 'slideout' | 'shelf' | 'focus' | 'menu';
/** Highest priority first: one Esc closes the newest item of the first non-empty layer. */
export const LAYER_ORDER: readonly Layer[] = ['dialog', 'floating', 'slideout', 'shelf', 'focus', 'menu'];
export interface PressResult { handled: boolean; layer: Layer | null; id: string | null; fallback: 'open-menu' | 'none' }
interface Dismissable { id: string; close: () => void }

export class DismissStack {
  private readonly layers = new Map<Layer, Dismissable[]>();

  private bucket(layer: Layer): Dismissable[] {
    const found = this.layers.get(layer);
    if (found) return found;
    const made: Dismissable[] = [];
    this.layers.set(layer, made);
    return made;
  }

  /** Registers something Esc can close; returns its (idempotent) unregister function. */
  register(layer: Layer, id: string, close: () => void): () => void {
    const list = this.bucket(layer);
    const stale = list.findIndex((e) => e.id === id);
    if (stale >= 0) list.splice(stale, 1); // re-registering an id moves it to the top
    const entry: Dismissable = { id, close };
    list.push(entry);
    return () => {
      const i = list.indexOf(entry);
      if (i >= 0) list.splice(i, 1);
    };
  }

  /** One Esc press: closes exactly the topmost thing, or asks the app to open the jump menu. */
  press(): PressResult {
    for (const layer of LAYER_ORDER) {
      const top = this.layers.get(layer)?.pop();
      if (top) {
        top.close();
        return { handled: true, layer, id: top.id, fallback: 'none' };
      }
    }
    return { handled: false, layer: null, id: null, fallback: 'open-menu' };
  }

  count(layer?: Layer): number {
    if (layer) return this.layers.get(layer)?.length ?? 0;
    let n = 0;
    for (const list of this.layers.values()) n += list.length;
    return n;
  }

  clear(): void {
    for (const list of this.layers.values()) list.length = 0;
  }
}

/* ---------------------------- 3. FLOATING WINDOWS --------------------------- */

export interface Rect { x: number; y: number; w: number; h: number }
export interface WindowOpts { minW?: number; minH?: number; title?: string }
export interface WindowInfo { id: string; rect: Rect; z: number; title: string }
export interface WindowLayout { viewport: { w: number; h: number }; windows: Array<WindowInfo & { minW: number; minH: number }> }
interface Win extends WindowInfo { minW: number; minH: number }

/** At least this many px of the title bar always stay on screen. */
export const TITLE_KEEP_PX = 48;
export const CASCADE_STEP_PX = 28;
const DEFAULT_MIN_W = 96;
const DEFAULT_MIN_H = 48;

export class WindowManager {
  private readonly wins = new Map<string, Win>();
  private zTop = 0;
  private vw: number;
  private vh: number;

  constructor(viewportW = 1920, viewportH = 1080) {
    this.vw = Math.max(1, num(viewportW, 1920));
    this.vh = Math.max(1, num(viewportH, 1080));
  }

  /** Windows are re-clamped so none leaves the new viewport. */
  setViewport(w: number, h: number): void {
    this.vw = Math.max(1, num(w, this.vw));
    this.vh = Math.max(1, num(h, this.vh));
    for (const win of this.wins.values()) this.fit(win);
  }

  /** Opens (or just focuses) a window. A new window landing exactly on another one is nudged 28 px. */
  open(id: string, rect: Rect, opts: WindowOpts = {}): WindowInfo {
    const existing = this.wins.get(id);
    if (existing) {
      this.bringToFront(id);
      return this.info(existing);
    }
    const win: Win = {
      id,
      rect: { x: num(rect.x, 0), y: num(rect.y, 0), w: num(rect.w, DEFAULT_MIN_W), h: num(rect.h, DEFAULT_MIN_H) },
      z: ++this.zTop,
      title: opts.title ?? id,
      minW: Math.max(1, num(opts.minW, DEFAULT_MIN_W)),
      minH: Math.max(1, num(opts.minH, DEFAULT_MIN_H)),
    };
    this.fit(win);
    for (let guard = 0; guard < 64 && this.occupied(win.rect.x, win.rect.y); guard++) {
      win.rect.x += CASCADE_STEP_PX;
      win.rect.y += CASCADE_STEP_PX;
      this.fit(win);
    }
    this.wins.set(id, win);
    return this.info(win);
  }

  close(id: string): boolean { return this.wins.delete(id); }
  get(id: string): WindowInfo | null {
    const win = this.wins.get(id);
    return win ? this.info(win) : null;
  }

  move(id: string, dx: number, dy: number): boolean {
    const win = this.wins.get(id);
    return win ? this.moveTo(id, win.rect.x + num(dx, 0), win.rect.y + num(dy, 0)) : false;
  }

  moveTo(id: string, x: number, y: number): boolean {
    const win = this.wins.get(id);
    if (!win) return false;
    win.rect.x = num(x, win.rect.x);
    win.rect.y = num(y, win.rect.y);
    this.fit(win);
    return true;
  }

  /** Respects the window's min size and the viewport. */
  resize(id: string, w: number, h: number): boolean {
    const win = this.wins.get(id);
    if (!win) return false;
    win.rect.w = num(w, win.rect.w);
    win.rect.h = num(h, win.rect.h);
    this.fit(win);
    return true;
  }

  bringToFront(id: string): boolean {
    const win = this.wins.get(id);
    if (!win) return false;
    if (win.z !== this.zTop) win.z = ++this.zTop;
    return true;
  }

  focused(): string | null {
    let top: Win | null = null;
    for (const win of this.wins.values()) if (!top || win.z > top.z) top = win;
    return top ? top.id : null;
  }

  /** Back to front. */
  list(): WindowInfo[] { return this.sorted().map((w) => this.info(w)); }

  /** Lays all windows out diagonally, 28 px apart (back to front), wrapping at the viewport. */
  cascade(): WindowInfo[] {
    let k = 0;
    for (const win of this.sorted()) {
      let off = k * CASCADE_STEP_PX;
      if (k > 0 && (off + win.rect.w > this.vw || off + win.rect.h > this.vh)) { k = 0; off = 0; }
      win.rect.x = off;
      win.rect.y = off;
      this.fit(win);
      k++;
    }
    return this.list();
  }

  toJSON(): WindowLayout {
    return {
      viewport: { w: this.vw, h: this.vh },
      windows: this.sorted().map((w) => ({ ...this.info(w), minW: w.minW, minH: w.minH })),
    };
  }

  /** Restores a toJSON() layout (object or JSON text). Junk → false, nothing changes; bad entries are skipped. */
  fromJSON(data: unknown): boolean {
    let parsed: unknown = data;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { return false; }
    }
    const items: unknown = isRecord(parsed) ? parsed['windows'] : undefined;
    if (!Array.isArray(items)) return false;
    const loaded: Win[] = [];
    for (const raw of items as unknown[]) {
      if (!isRecord(raw)) continue;
      const id = raw['id'];
      const r = raw['rect'];
      const title = raw['title'];
      if (typeof id !== 'string' || !isRecord(r)) continue;
      loaded.push({
        id,
        rect: { x: num(r['x'], 0), y: num(r['y'], 0), w: num(r['w'], DEFAULT_MIN_W), h: num(r['h'], DEFAULT_MIN_H) },
        z: num(raw['z'], loaded.length),
        title: typeof title === 'string' ? title : id,
        minW: Math.max(1, num(raw['minW'], DEFAULT_MIN_W)),
        minH: Math.max(1, num(raw['minH'], DEFAULT_MIN_H)),
      });
    }
    this.wins.clear();
    this.zTop = 0;
    loaded.sort((a, b) => a.z - b.z);
    for (const win of loaded) {
      if (this.wins.has(win.id)) continue;
      if (win.z <= this.zTop) win.z = this.zTop + 1;
      this.zTop = win.z;
      this.fit(win);
      this.wins.set(win.id, win);
    }
    return true;
  }

  private sorted(): Win[] { return Array.from(this.wins.values()).sort((a, b) => a.z - b.z); }
  private info(win: Win): WindowInfo {
    return { id: win.id, rect: { ...win.rect }, z: win.z, title: win.title };
  }
  private occupied(x: number, y: number): boolean {
    for (const o of this.wins.values()) if (o.rect.x === x && o.rect.y === y) return true;
    return false;
  }
  /** Min sizes, viewport-bounded size, and the title bar never off screen (≥ 48 px of it visible). */
  private fit(win: Win): void {
    const r = win.rect;
    r.w = clamp(r.w, win.minW, Math.max(win.minW, this.vw));
    r.h = clamp(r.h, win.minH, Math.max(win.minH, this.vh));
    const keepX = Math.min(TITLE_KEEP_PX, r.w);
    const keepY = Math.min(TITLE_KEEP_PX, r.h);
    r.x = clamp(r.x, keepX - r.w, this.vw - keepX);
    r.y = clamp(r.y, 0, this.vh - keepY);
  }
}

/* ---------------------------- 4. AUTO-HIDE SHELVES -------------------------- */

export type Edge = 'left' | 'right' | 'bottom' | 'top';
export interface ShelfOptions { edge: Edge; hideAfterMs: number; peek: number }
export interface ShelfState { open: boolean; progress: number }
/** Slide duration: progress eases (cubic ease-out) over this many ms. */
export const SHELF_SLIDE_MS = 180;

const easeOutCubic = (x: number): number => 1 - (1 - x) ** 3;

/**
 * Edge panel that reveals when the pointer comes within `peek` px of its edge and slides away
 * `hideAfterMs` after the pointer last touched it, unless pinned. All times (ms) come from the caller.
 */
export class Shelf {
  readonly edge: Edge;
  readonly hideAfterMs: number;
  readonly peek: number;
  private pinned = false;
  private target: 0 | 1 = 0; // 1 = shown, 0 = hidden
  private from = 0; // progress when the current slide began
  private start: number | null = null; // slide start time; null = starts at the next tick
  private progress = 0;
  private lastTouch: number | null = null; // null = the hide timer starts at the next tick

  constructor(opts: ShelfOptions) {
    this.edge = opts.edge;
    this.hideAfterMs = Math.max(0, num(opts.hideAfterMs, 0));
    this.peek = Math.max(0, num(opts.peek, 0));
  }

  isOpen(): boolean { return this.target === 1; }
  isPinned(): boolean { return this.pinned; }

  /** Reveals when the pointer is within `peek` px of the edge; returns whether that counted as a touch. */
  pointerNear(edgeDistancePx: number, t: number): boolean {
    if (!(edgeDistancePx <= this.peek)) return false;
    this.touch(t);
    return true;
  }
  pointerInside(t: number): void { this.touch(t); }

  /** Pinned shelves never auto-hide. Unpinning restarts the hide timer (at `t`, else at the next tick). */
  pin(on: boolean, t?: number): void {
    this.pinned = on;
    if (on) this.setTarget(1, t ?? null);
    else this.lastTouch = t ?? null;
  }
  show(t?: number): void {
    this.setTarget(1, t ?? null);
    this.lastTouch = t ?? null;
  }
  hide(t?: number): void { this.setTarget(0, t ?? null); }

  /** Advances to time `t`. `open` is the target state, `progress` the eased 0..1 slide position. */
  tick(t: number): ShelfState {
    if (this.target === 1 && !this.pinned) {
      if (this.lastTouch === null) this.lastTouch = t;
      else if (t - this.lastTouch >= this.hideAfterMs) this.setTarget(0, this.lastTouch + this.hideAfterMs);
    }
    if (this.start === null) this.start = t;
    this.progress = this.progressAt(t);
    return { open: this.target === 1, progress: this.progress };
  }

  private touch(t: number): void {
    this.lastTouch = t;
    if (this.target !== 1) this.setTarget(1, t);
  }

  private setTarget(target: 0 | 1, t: number | null): void {
    if (this.target === target) return;
    this.from = t === null ? this.progress : this.progressAt(t);
    this.target = target;
    this.start = t;
  }

  private progressAt(t: number): number {
    if (this.start === null) return this.from;
    const raw = clamp((t - this.start) / SHELF_SLIDE_MS, 0, 1);
    return this.from + (this.target - this.from) * easeOutCubic(raw);
  }
}