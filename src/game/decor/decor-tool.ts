/**
 * NewDecor — the brush, the eraser, and the buttons the panel presses.
 *
 * **Brush.** Drag on the ground: every `flow` units of pointer travel a stamp scatters decorations
 * inside the brush circle. The circle is converted to track space around the hit point, so the stamp
 * knows where the road is and never puts a tree on it (unless `allowRoad` is on — for decals and
 * crowds on a start straight). Density, spacing, size variety and palette are adjustable; every stamp
 * is seeded from its position so dragging back over the same ground re-draws the same forest rather
 * than piling it up.
 *
 * **Eraser.** Same circle, removes decorations. By default only *decorations* (catalogued kinds), and
 * with `autoOnly` only the ones a rule or the brush placed — a hand-placed sign survives a sweep.
 *
 * **Heights.** A site off the road is dropped onto the terrain with a downward ray against the course's
 * scenery (never against placed props); with no ground under it, it keeps the road plane's height.
 *
 * **Batches.** Everything goes through `DecorHost.applyDecorBatch`, one undo step per stroke or run,
 * and every prop carries a `decor` tag `{rule, batch, seed}` plus `groupId = decor_<batch>`, so the
 * builder's own group-select picks a whole run with one click.
 */
import * as THREE from 'three';
import type { PlacedProp } from '../builder/prop-catalog';
import { DECOR_PALETTES, decorPalette, isDecorKind, type DecorPalette } from './decor-catalog';
import {
  SiteIndex, decorTagOf, faceRoadYaw, hashSeed, makeRng, pickKind, placementToProp, projectToTrack,
  type DecorPlacement, type DecorTrack, type DecorTag, type Rng,
} from './decor-field';
import { DECOR_RULES, decorRule, defaultParams, withParams, runRule, runTheme, stageSpans, type DecorRule, type RuleParams } from './auto-decorate';
import type { TrackStageId } from '../track-space';

/** What the tool needs from the builder — kept tiny so a test can hand it a stub. */
export interface DecorHost {
  getProps(): readonly PlacedProp[];
  /**
   * Remove `removeIds`, add `add`, save, redraw. One undo step — unless `coalesce` is true, in which case
   * it joins the previous batch (the later stamps of one brush stroke).
   */
  applyDecorBatch(label: string, add: PlacedProp[], removeIds: readonly string[], coalesce?: boolean): void;
}

export interface BrushSettings {
  palette: string;
  /** World units. */
  radius: number;
  /** Props per stamp at radius 600 (scales with area). */
  density: number;
  /** Multiplies each kind's footprint when testing for room. */
  spacing: number;
  sizeVariety: number;
  /** Stamps at least this far apart along the stroke. */
  flow: number;
  allowRoad: boolean;
  erase: boolean;
  /** Eraser: only rule/brush-placed decorations. */
  autoOnly: boolean;
}

export type SpanMode = 'track' | 'stage' | 'window';

export interface RunRequest {
  rule: string;
  params?: Partial<RuleParams>;
  palette?: string;
  span?: SpanMode | readonly [number, number];
  /** Window half-length around the camera, for `span: 'window'`. */
  window?: number;
  seed?: number;
  budget?: number;
  /** Replace what this rule placed before on the same span. */
  replace?: boolean;
}

export interface RunResult {
  batch: string;
  added: number;
  removed: number;
  span: readonly [number, number];
  seed: number;
}

const DEFAULT_BRUSH: BrushSettings = {
  palette: DECOR_PALETTES[0].id, radius: 600, density: 4, spacing: 1, sizeVariety: 0.6, flow: 200,
  allowRoad: false, erase: false, autoOnly: true,
};

const SKIP_GROUND = new Set(['Sky', 'MistZone', 'DebugMarkers', 'GizmoPivotProxy', 'LaneGizmos', 'LaneHandles', 'LanePaint', 'RoadSurfacePaint', 'GroundBrush', 'DecorBrush', 'RacerCaps', 'RacerShadows', 'RacerShields']);
const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);

export class DecorTool {
  readonly brush: BrushSettings = { ...DEFAULT_BRUSH };
  private enabled = false;
  private painting = false;
  private lastStamp: THREE.Vector3 | null = null;
  private strokeAdds: PlacedProp[] = [];
  private strokeRemoves = new Set<string>();
  private strokeIndex: SiteIndex | null = null;
  private strokeBatch = '';
  private strokeCount = 0;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly ring: THREE.Mesh;
  private groundCache: THREE.Object3D[] | null = null;
  private listeners: (() => void)[] = [];
  private lastRun: RunResult | null = null;

  constructor(
    private readonly host: DecorHost,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly dom: HTMLElement,
    readonly track: DecorTrack,
  ) {
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.94, 1, 64),
      new THREE.MeshBasicMaterial({ color: 0x7ee0a0, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.ring.name = 'DecorBrush';
    this.ring.renderOrder = 999;
    this.ring.visible = false;
    scene.add(this.ring);
    // Capture: ahead of the builder's own canvas listener, so a brush stroke never also selects or places.
    dom.addEventListener('pointerdown', this.onDown, { capture: true });
    dom.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
  }

  /* ───────────── state the panel reads ───────────── */

  get isEnabled(): boolean { return this.enabled; }
  get lastResult(): RunResult | null { return this.lastRun; }
  get rules(): readonly DecorRule[] { return DECOR_RULES; }
  get palettes(): readonly DecorPalette[] { return DECOR_PALETTES; }

  onChange(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
  }
  private notify() { for (const cb of this.listeners) cb(); }

  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    this.painting = false;
    this.ring.visible = false;
    this.groundCache = null;
    this.notify();
  }

  setBrush(changes: Partial<BrushSettings>): void {
    Object.assign(this.brush, changes);
    this.brush.radius = Math.max(60, Math.min(4000, this.brush.radius));
    this.brush.density = Math.max(0.2, Math.min(40, this.brush.density));
    this.notify();
  }

  /** How many decorations stand on the course, and how many of them a rule or brush placed. */
  counts(): { decor: number; auto: number; byRule: Record<string, number> } {
    let decor = 0, auto = 0;
    const byRule: Record<string, number> = {};
    for (const prop of this.host.getProps()) {
      if (!isDecorKind(prop.type)) continue;
      decor++;
      const tag = decorTagOf(prop);
      if (tag) { auto++; byRule[tag.rule] = (byRule[tag.rule] ?? 0) + 1; }
    }
    return { decor, auto, byRule };
  }

  /* ───────────── spans ───────────── */

  /** Arc-length of the road nearest the camera. */
  cameraS(): number {
    return projectToTrack(this.track, this.camera.position).s;
  }

  stageAtCamera(): TrackStageId {
    return this.track.sampleAt(this.cameraS()).stage;
  }

  resolveSpan(span: RunRequest['span'], window = 4000): readonly [number, number] {
    if (Array.isArray(span)) return [Math.max(0, Math.min(span[0], span[1])), Math.min(this.track.length, Math.max(span[0], span[1]))];
    const mode = (span as SpanMode | undefined) ?? 'track';
    if (mode === 'track') return [0, this.track.length];
    const s = this.cameraS();
    if (mode === 'window') return [Math.max(0, s - window), Math.min(this.track.length, s + window)];
    const stage = this.track.sampleAt(s).stage;
    const spans = stageSpans(this.track).filter((x) => x.stage === stage);
    const here = spans.find((x) => s >= x.s0 && s <= x.s1) ?? spans[0];
    return here ? [here.s0, here.s1] : [0, this.track.length];
  }

  /* ───────────── auto-decorate ───────────── */

  /** Run one rule. `replace` clears that rule's earlier props inside the span first. */
  run(req: RunRequest): RunResult {
    const rule = decorRule(req.rule);
    if (!rule) throw new Error(`[decor] unknown rule ${req.rule}`);
    const span = this.resolveSpan(req.span, req.window);
    const palette = decorPalette(req.palette ?? rule.defaultPalette);
    const seed = req.seed ?? ((Date.now() & 0xffff) ^ hashSeed(rule.id));
    const removeIds = req.replace === false ? [] : this.idsOfRule(rule.id, span);
    const remaining = new Set(removeIds);
    const existing = this.host.getProps().filter((p) => !remaining.has(p.id));
    const placements = runRule(rule, withParams(defaultParams(rule), req.params), palette, { track: this.track, span, existing, seed, budget: req.budget });
    const batch = this.newBatch(rule.id);
    const add = this.toProps(placements, { rule: rule.id, batch, seed });
    this.host.applyDecorBatch(`Auto-decorate: ${rule.name}`, add, removeIds);
    this.lastRun = { batch, added: add.length, removed: removeIds.length, span, seed };
    this.notify();
    return this.lastRun;
  }

  /** Preview without committing: how many a run would place. */
  preview(req: RunRequest): number {
    const rule = decorRule(req.rule);
    if (!rule) return 0;
    const span = this.resolveSpan(req.span, req.window);
    const palette = decorPalette(req.palette ?? rule.defaultPalette);
    const seed = req.seed ?? hashSeed(rule.id);
    const ids = new Set(req.replace === false ? [] : this.idsOfRule(rule.id, span));
    const existing = this.host.getProps().filter((p) => !ids.has(p.id));
    return runRule(rule, withParams(defaultParams(rule), req.params), palette, { track: this.track, span, existing, seed, budget: req.budget }).length;
  }

  /** The whole theme (every step on its stages) over a span, as one undo step. */
  runTheme(opts: { span?: RunRequest['span']; window?: number; seed?: number; intensity?: number; budget?: number; replace?: boolean } = {}): RunResult {
    const span = this.resolveSpan(opts.span, opts.window);
    const seed = opts.seed ?? (Date.now() & 0xffff);
    const removeIds = opts.replace === false ? [] : this.idsOfRule(null, span);
    const remaining = new Set(removeIds);
    const existing = this.host.getProps().filter((p) => !remaining.has(p.id));
    const batch = this.newBatch('theme');
    const add: PlacedProp[] = [];
    for (const { rule, placements } of runTheme({ track: this.track, span, existing, seed, intensity: opts.intensity, budget: opts.budget })) {
      add.push(...this.toProps(placements, { rule, batch, seed }, add.length));
    }
    this.host.applyDecorBatch('Auto-decorate: theme', add, removeIds);
    this.lastRun = { batch, added: add.length, removed: removeIds.length, span, seed };
    this.notify();
    return this.lastRun;
  }

  /** Remove what a rule placed (all rules when null) inside a span. Returns how many. */
  clear(rule: string | null, span: RunRequest['span'] = 'track', window?: number): number {
    const ids = this.idsOfRule(rule, this.resolveSpan(span, window));
    if (ids.length) this.host.applyDecorBatch(rule ? `Clear ${rule} decorations` : 'Clear auto decorations', [], ids);
    this.notify();
    return ids.length;
  }

  /** Re-roll the last run with a new seed (same rule, same span, same numbers). */
  reroll(req: RunRequest): RunResult {
    return this.run({ ...req, seed: (Math.random() * 0xffffffff) >>> 0, replace: true });
  }

  private idsOfRule(rule: string | null, span: readonly [number, number]): string[] {
    const ids: string[] = [];
    for (const prop of this.host.getProps()) {
      const tag = decorTagOf(prop);
      if (!tag || (rule && tag.rule !== rule)) continue;
      const s = typeof prop.trackDist === 'number' ? prop.trackDist : projectToTrack(this.track, prop).s;
      if (s >= span[0] - 1 && s <= span[1] + 1) ids.push(prop.id);
    }
    return ids;
  }

  private newBatch(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  }

  private toProps(placements: DecorPlacement[], tag: DecorTag, offset = 0): PlacedProp[] {
    return placements.map((placement, i) => placementToProp(this.track, placement, tag, offset + i, (_, world) => this.groundHeight(world, placement.kind.footprint)));
  }

  /* ───────────── ground ───────────── */

  /** The course's scenery: everything in the scene that is not a placed prop, a light, a camera or a helper. */
  private groundTargets(): THREE.Object3D[] {
    if (this.groundCache) return this.groundCache;
    this.groundCache = this.scene.children.filter((o) =>
      !(o as THREE.Light).isLight && !(o as THREE.Camera).isCamera && !SKIP_GROUND.has(o.name)
      && !o.name.startsWith('PlacedProp_') && !o.name.startsWith('TerrainPivot_') && !o.name.startsWith('TransformControls') && !o.name.startsWith('Racer'));
    return this.groundCache;
  }

  /** Where the ground is under a world point, or undefined when nothing is there. */
  groundHeight(world: { x: number; y: number; z: number }, footprint: number): number | undefined {
    const from = new THREE.Vector3(world.x, world.y + 3000, world.z);
    this.raycaster.set(from, new THREE.Vector3(0, -1, 0));
    this.raycaster.far = 9000;
    const hits = this.raycaster.intersectObjects(this.groundTargets(), true);
    for (const hit of hits) {
      if ((hit.object as THREE.Sprite).isSprite) continue;
      // Ignore hits that are wildly above the road plane (a cave ceiling, a bridge deck overhead).
      if (hit.point.y - world.y > footprint * 3 + 600) continue;
      return hit.point.y;
    }
    return undefined;
  }

  /* ───────────── brush ───────────── */

  private hitGround(event: PointerEvent): THREE.Vector3 | null {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.far = Infinity;
    const hit = this.raycaster.intersectObjects(this.groundTargets(), true).find((h) => !(h.object as THREE.Sprite).isSprite);
    return hit ? hit.point.clone() : null;
  }

  /**
   * One stamp at a world point. Pure enough to test: the sites come from a seeded scatter in track
   * space around the hit, so the same circle stamped twice yields nothing new the second time.
   */
  stampAt(point: { x: number; y: number; z: number }): PlacedProp[] {
    const b = this.brush;
    const centre = projectToTrack(this.track, point);
    const palette = decorPalette(b.palette);
    const seed = hashSeed(`${Math.round(centre.s / 50)}:${Math.round(centre.lateral / 50)}:${b.palette}`);
    const rng: Rng = makeRng(seed);
    const index = this.strokeIndex ?? (this.strokeIndex = SiteIndex.fromProps(this.track, this.host.getProps()));
    const area = Math.PI * b.radius * b.radius;
    const count = Math.max(1, Math.round(b.density * area / (Math.PI * 600 * 600)));
    const out: PlacedProp[] = [];
    const tag: DecorTag = { rule: 'brush', batch: this.strokeBatch, seed };
    for (let i = 0; i < count * 5 && out.length < count; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * b.radius;
      const s = centre.s + Math.cos(a) * r, lateral = centre.lateral + Math.sin(a) * r;
      if (s < 0 || s > this.track.length) continue;
      const sample = this.track.sampleAt(s);
      if (sample.inLoop) continue;
      const kind = pickKind(palette, sample.stage, rng);
      if (!kind) continue;
      const mid = (kind.scale[0] + kind.scale[1]) / 2;
      const scale = mid + (rng.range(kind.scale[0], kind.scale[1]) - mid) * b.sizeVariety;
      const radius = kind.footprint * scale;
      if (!b.allowRoad && Math.abs(lateral) < sample.halfWidth + radius * 0.5) continue;
      if (index.blocked(s, lateral, radius * b.spacing)) continue;
      const side = Math.sign(lateral) || 1;
      const placement: DecorPlacement = {
        kind, s, lateral, scale,
        rotY: kind.faceTrack ? faceRoadYaw(sample, side) + rng.range(-0.2, 0.2) : rng.range(0, Math.PI * 2),
        flipX: kind.flip && rng() < 0.5,
      };
      index.add(s, lateral, radius);
      out.push(placementToProp(this.track, placement, tag, this.strokeCount++, (_, world) => this.groundHeight(world, kind.footprint)));
    }
    return out;
  }

  /** Decorations inside the brush circle around a world point (the eraser's victims). */
  eraseAt(point: { x: number; y: number; z: number }): string[] {
    const centre = projectToTrack(this.track, point);
    const ids: string[] = [];
    for (const prop of this.host.getProps()) {
      if (!isDecorKind(prop.type)) continue;
      if (this.brush.autoOnly && !decorTagOf(prop)) continue;
      const p = projectToTrack(this.track, prop);
      if (Math.abs(p.altitude) > 1500) continue;
      if (Math.hypot(p.s - centre.s, p.lateral - centre.lateral) <= this.brush.radius) ids.push(prop.id);
    }
    return ids;
  }

  private readonly onDown = (event: PointerEvent) => {
    if (!this.enabled || event.button !== 0) return;
    const point = this.hitGround(event);
    if (!point) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.painting = true;
    this.strokeAdds = [];
    this.strokeRemoves.clear();
    this.strokeIndex = null;
    this.strokeCount = 0;
    this.strokeBatch = this.newBatch('brush');
    this.lastStamp = null;
    this.stamp(point);
  };

  private readonly onMove = (event: PointerEvent) => {
    if (!this.enabled) return;
    const point = this.hitGround(event);
    if (!point) { this.ring.visible = false; return; }
    const { sample } = projectToTrack(this.track, point);
    const normal = new THREE.Vector3(sample.up.x, sample.up.y, sample.up.z);
    this.ring.position.copy(point).addScaledVector(normal, 6);
    this.ring.quaternion.setFromUnitVectors(PLANE_NORMAL, normal);
    this.ring.scale.setScalar(this.brush.radius);
    (this.ring.material as THREE.MeshBasicMaterial).color.set(this.brush.erase ? 0xff7a7a : 0x7ee0a0);
    this.ring.visible = true;
    if (this.painting) {
      if (this.lastStamp && this.lastStamp.distanceTo(point) < this.brush.flow) return;
      this.stamp(point);
    }
  };

  private stamp(point: THREE.Vector3) {
    this.lastStamp = point.clone();
    if (this.brush.erase) {
      for (const id of this.eraseAt(point)) this.strokeRemoves.add(id);
      // Show the erase live: a stroke of the eraser is still one undo step at pointer-up.
      return;
    }
    const added = this.stampAt(point);
    if (added.length) {
      // Live feedback: each stamp lands at once; only the first stamp of a stroke opens an undo step.
      const first = this.strokeAdds.length === 0;
      this.strokeAdds.push(...added);
      this.host.applyDecorBatch('Decorate', added, [], !first);
    }
  }

  private readonly onUp = () => {
    if (!this.painting) return;
    this.painting = false;
    if (this.strokeRemoves.size) this.host.applyDecorBatch('Erase decorations', [], [...this.strokeRemoves]);
    this.strokeRemoves.clear();
    this.strokeIndex = null;
    this.notify();
  };

  dispose(): void {
    this.dom.removeEventListener('pointerdown', this.onDown, { capture: true });
    this.dom.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.scene.remove(this.ring);
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.listeners.length = 0;
  }
}

/** Convenience for the panel: a rule's schema with current values filled in. */
export function ruleControls(rule: DecorRule, current: Partial<RuleParams> = {}) {
  return rule.params.map((spec) => ({ spec, value: current[spec.key] ?? spec.default }));
}
