import * as THREE from 'three';
import type { GraphicsSettings } from './graphics';

/**
 * Lamps placed in the world (the Lights tab, F6): a fixed pool of point and spot lights, each with a small glowing bulb so you can see
 * where it is. The pool never grows or shrinks while you play (three.js recompiles every material when the number of lights changes);
 * lights not in use are dark. How many a screen can afford comes from the graphics settings: none on Potato.
 */
type V3 = readonly [number, number, number];
export interface LampLight {
  readonly kind: 'point' | 'spot';
  readonly pos: V3;
  readonly dir: V3;
  readonly color: string;
  /** 0..10, the lamp preset's own scale (flicker already applied). */
  readonly intensity: number;
  /** metres: no light beyond it. */
  readonly range: number;
  /** spot half-angle in degrees, and the soft share of its edge. */
  readonly angle: number;
  readonly penumbra: number;
}

/** How many lamps of each kind a graphics setting lights. */
export function lampBudget(g: GraphicsSettings): { points: number; spots: number } {
  if (g.pictureSize > 0 && g.pictureSize <= 480) return { points: 0, spots: 0 };
  if (!g.effects) return { points: 2, spots: 1 };
  return { points: 4, spots: 2 };
}

/** The renderer's intensity for a preset's 0..10 at its range: bright pools of light that fade out by the range (decay 2). */
export const lampCandela = (intensity: number, range: number): number => intensity * range * range * 0.12;

export class LightPool {
  readonly group = new THREE.Group();
  private readonly points: { light: THREE.PointLight; bulb: THREE.Mesh }[] = [];
  private readonly spots: { light: THREE.SpotLight; bulb: THREE.Mesh }[] = [];
  private readonly bulbGeometry = new THREE.SphereGeometry(0.09, 10, 8);

  constructor(readonly budget: { points: number; spots: number }) {
    const bulb = (): THREE.Mesh => { const m = new THREE.Mesh(this.bulbGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); m.visible = false; this.group.add(m); return m; };
    for (let i = 0; i < budget.points; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 10, 2);
      light.castShadow = false;
      this.group.add(light);
      this.points.push({ light, bulb: bulb() });
    }
    for (let i = 0; i < budget.spots; i++) {
      const light = new THREE.SpotLight(0xffffff, 0, 10, Math.PI / 6, 0.3, 2);
      light.castShadow = false;
      this.group.add(light, light.target);
      this.spots.push({ light, bulb: bulb() });
    }
  }

  /** Light these lamps (already picked and in order of importance); the rest of the pool goes dark. */
  set(lamps: readonly LampLight[]): void {
    let p = 0, s = 0;
    for (const l of lamps) {
      const slot = l.kind === 'spot' ? this.spots[s++] : this.points[p++];
      if (!slot) continue;
      slot.light.color.set(l.color);
      slot.light.intensity = lampCandela(Math.max(0, l.intensity), l.range);
      slot.light.distance = l.range;
      slot.light.position.set(l.pos[0], l.pos[1], l.pos[2]);
      if (slot.light instanceof THREE.SpotLight) {
        slot.light.angle = (Math.min(89, Math.max(1, l.angle)) * Math.PI) / 180;
        slot.light.penumbra = Math.min(1, Math.max(0, l.penumbra));
        slot.light.target.position.set(l.pos[0] + l.dir[0], l.pos[1] + l.dir[1], l.pos[2] + l.dir[2]);
        slot.light.target.updateMatrixWorld();
      }
      slot.bulb.visible = true;
      slot.bulb.position.set(l.pos[0], l.pos[1], l.pos[2]);
      (slot.bulb.material as THREE.MeshBasicMaterial).color.set(l.color).multiplyScalar(0.6 + Math.min(1, l.intensity / 4) * 0.6);
    }
    for (let i = p; i < this.points.length; i++) { this.points[i]!.light.intensity = 0; this.points[i]!.bulb.visible = false; }
    for (let i = s; i < this.spots.length; i++) { this.spots[i]!.light.intensity = 0; this.spots[i]!.bulb.visible = false; }
  }

  dispose(): void {
    this.bulbGeometry.dispose();
    for (const { bulb } of [...this.points, ...this.spots]) (bulb.material as THREE.Material).dispose();
    this.group.removeFromParent();
    this.group.clear();
  }
}
