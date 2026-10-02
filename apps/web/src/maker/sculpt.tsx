import type { ReactElement } from 'react';
import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import type { ModelPlacement } from '@hm/render';
import { decodeModel, encodeModel, type VoxelModel } from '@hm/voxel';
import { SculptSession, brushCells, raycast, raycastGround, type BrushShape, type V3 } from '@hm/voxelsculpt';

/**
 * Sculpting a voxel model from inside focus mode. The pointer ray is moved into the grid of the model (undoing its place, turn and block size),
 * the brush cells come from @hm/voxelsculpt, and the whole stroke is one undoable `data` edit on the model preset.
 */

export interface SculptUi { mode: 'add' | 'remove' | 'paint'; shape: BrushShape; size: number; colour: number; mirrorX: boolean }
export const DEFAULT_SCULPT: SculptUi = { mode: 'add', shape: 'cube', size: 1, colour: 1, mirrorX: false };

const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];

export class ModelSculptor {
  private readonly session: SculptSession;
  private readonly p: { x: number; y: number; z: number; yaw: number; scale: number };
  private touched = false;

  private constructor(
    private readonly rt: Runtime, private readonly id: PresetId, private readonly base: VoxelModel, private readonly params: Record<string, unknown>,
    private readonly ui: SculptUi, private readonly live: (placements: ModelPlacement[]) => void, private readonly others: () => ModelPlacement[],
  ) {
    this.p = { x: Number(params['x'] ?? 0), y: Number(params['y'] ?? 0), z: Number(params['z'] ?? 0), yaw: (Number(params['yaw'] ?? 0) * Math.PI) / 180, scale: Math.max(1e-3, Number(params['scale'] ?? 0.1)) };
    this.session = new SculptSession({ size: base.size, palette: base.palette.map((e) => ({ color: e.color })), cells: base.cells.slice() });
    this.session.symmetry.x = ui.mirrorX;
  }

  static start(rt: Runtime, id: PresetId, ui: SculptUi, live: (p: ModelPlacement[]) => void, others: () => ModelPlacement[]): ModelSculptor | null {
    const params = rt.store.resolve(id).params as Record<string, unknown>;
    const data = typeof params['data'] === 'string' ? (params['data'] as string) : '';
    const model = data ? decodeModel(data).model : null;
    return model ? new ModelSculptor(rt, id, model, params, ui, live, others) : null;
  }

  /** world ray -> the grid of the model (voxel units, y up) */
  private toGrid(origin: readonly number[], dir: readonly number[]): { o: V3; d: V3 } {
    const c = Math.cos(-this.p.yaw), s = Math.sin(-this.p.yaw);
    const rot = (v: readonly number[]): V3 => [v[0]! * c + v[2]! * s, v[1]!, -v[0]! * s + v[2]! * c];
    const o = rot(sub(origin, [this.p.x, this.p.y, this.p.z]));
    const pv = this.base.pivot;
    return { o: [o[0] / this.p.scale + pv[0]!, o[1] / this.p.scale + pv[1]!, o[2] / this.p.scale + pv[2]!], d: rot(dir) };
  }

  /** Apply the brush where the ray lands; returns false when it hits nothing. */
  dab(ray: { readonly origin: readonly number[]; readonly direction: readonly number[] }, first: boolean): boolean {
    const { o, d } = this.toGrid(ray.origin, ray.direction);
    const model = this.session.model();
    const hit = raycast(model, o, d);
    let centre: V3 | null = null;
    let normal: V3 = [0, 1, 0];
    if (hit) { centre = this.ui.mode === 'add' ? hit.before ?? hit.cell : hit.cell; normal = hit.normal; }
    else if (this.ui.mode === 'add') {
      const g = raycastGround(o, d, 0);
      if (g && g.point[0] >= 0 && g.point[2] >= 0 && g.point[0] < model.size[0] && g.point[2] < model.size[2]) centre = [Math.floor(g.point[0]), 0, Math.floor(g.point[2])];
    }
    if (!centre) return false;
    if (first) this.session.beginStroke(this.ui.mode);
    this.session.dab(this.ui.mode, brushCells(this.ui.shape, centre, this.ui.size, normal), this.ui.mode === 'remove' ? 0 : this.ui.colour);
    this.touched = true;
    this.live([...this.others(), this.placement(this.session.model().cells)]);
    return true;
  }

  private placement(cells: Uint8Array): ModelPlacement {
    const data = encodeModel({ ...this.base, cells });
    return { params: { ...this.params, data }, x: this.p.x, y: this.p.y, z: this.p.z, yawDeg: (this.p.yaw * 180) / Math.PI };
  }

  /** One undo step on the preset for the whole stroke. */
  end(): boolean {
    this.session.endStroke();
    if (!this.touched) return false;
    const data = encodeModel({ ...this.base, cells: this.session.model().cells });
    this.rt.commands.execute(cmd.setParam(`${this.id}.data`, data as never, `Sculpt (${this.ui.mode})`));
    return true;
  }
}

/** Mode, brush, size, mirror and colour for sculpting; sits under the focus bar while the brush is active on a model. */
export function SculptBar(props: { readonly ui: SculptUi; readonly palette: readonly { name: string; color: readonly number[] }[]; readonly onChange: (u: SculptUi) => void }): ReactElement {
  const { ui, palette, onChange } = props;
  const set = (p: Partial<SculptUi>): void => onChange({ ...ui, ...p });
  const rgb = (c: readonly number[]): string => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
  return (
    <div className="sculpt-bar" role="toolbar" aria-label="Sculpt">
      {(['add', 'remove', 'paint'] as const).map((m) => <button key={m} className={ui.mode === m ? 'on' : ''} onClick={() => set({ mode: m })}>{m === 'add' ? '＋ Build' : m === 'remove' ? '－ Dig' : '🖌 Paint'}</button>)}
      <select aria-label="Brush shape" value={ui.shape} onChange={(e) => set({ shape: e.target.value as BrushShape })}><option value="cube">Cube</option><option value="sphere">Sphere</option><option value="disc">Disc</option></select>
      <label>Size <input type="range" min={1} max={8} value={ui.size} onChange={(e) => set({ size: Number(e.target.value) })} /> {ui.size}</label>
      <label><input type="checkbox" checked={ui.mirrorX} onChange={(e) => set({ mirrorX: e.target.checked })} /> Mirror</label>
      <span className="swatches">{palette.map((p, i) => <button key={i} title={p.name} aria-label={p.name} className={ui.colour === i + 1 ? 'on' : ''} style={{ background: rgb(p.color), width: 22, height: 22, minWidth: 22, padding: 0 }} onClick={() => set({ colour: i + 1 })} />)}</span>
    </div>
  );
}
