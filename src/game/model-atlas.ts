import type { GameAssets } from './assets';
import { Mesh, WorldPainter } from './geometry';
import { Machinery } from './machinery';
import { createMaterials } from './materials';
import { RangeCamera } from './projection';
import { GROUND, LAUNCHER, START_X } from './scene';

export type ModelName = 'sling' | 'loop' | 'ramp';
export interface ModelLayer {
  image: HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
}
export interface BakedModel {
  layers: ModelLayer[];
  width: number;
  height: number;
  referenceScale: number;
}
export type ModelAtlas = Record<'range' | 'side', Record<ModelName, BakedModel>>;

let cached: { deck: HTMLImageElement; atlas: ModelAtlas } | null = null;

export function buildModelAtlas(assets: Pick<GameAssets, 'deck'>): ModelAtlas {
  if (cached?.deck === assets.deck.image) return cached.atlas;
  const machinery = new Machinery(createMaterials(assets));
  const meshes: Record<ModelName, { mesh: Mesh; x: number; width: number; height: number }> = {
    sling: { mesh: machinery.launcher, x: LAUNCHER.x, width: 270, height: 270 },
    ramp: { mesh: machinery.obstacle({ kind: 'ramp', x: 480, width: 190, height: 113, hit: false, hitAt: 0 }), x: 575, width: 190, height: 113 },
    loop: { mesh: machinery.obstacle({ kind: 'loop', x: 980, width: 375, height: 322, hit: false, hitAt: 0 }), x: 980, width: 375, height: 322 },
  };
  const atlas = {} as ModelAtlas;
  for (const mode of ['range', 'side'] as const) {
    const view = new RangeCamera();
    atlas[mode] = {} as Record<ModelName, BakedModel>;
    for (const name of Object.keys(meshes) as ModelName[]) {
      const source = meshes[name];
      view.configure(1700, source.x - START_X, mode === 'range', 0);
      const origin = view.project(source.x, GROUND);
      const buckets = new Map<number, Mesh>();
      for (const face of source.mesh.faces) {
        // Three permanent depth layers retain the near rim in front of the pilot.
        const depth = face.center.z < -27 ? -58 : face.center.z > 27 ? 58 : 0;
        let bucket = buckets.get(depth);
        if (!bucket) { bucket = new Mesh(); buckets.set(depth, bucket); }
        bucket.faces.push(face);
      }
      const layers: ModelLayer[] = [];
      for (const [depth, mesh] of buckets) {
        const visible = mesh.faces.filter((face) => view.facing(face.center, face.normal));
        const points = visible.flatMap((face) => face.points.map((p) => view.project(p.x, p.y, p.z)));
        if (!points.length) continue;
        const left = Math.min(...points.map((p) => p.x)) - 2;
        const top = Math.min(...points.map((p) => p.y)) - 2;
        const width = Math.max(...points.map((p) => p.x)) - left + 2;
        const height = Math.max(...points.map((p) => p.y)) - top + 2;
        const image = document.createElement('canvas');
        const density = 1.6;
        image.width = Math.ceil(width * density);
        image.height = Math.ceil(height * density);
        const context = image.getContext('2d')!;
        context.setTransform(density, 0, 0, density, -left * density, -top * density);
        const painter = new WorldPainter(context, view);
        painter.mesh(mesh);
        painter.flush();
        layers.push({ image, x: left - origin.x, y: top - origin.y, width: image.width / density, height: image.height / density, depth });
      }
      atlas[mode][name] = { layers, width: source.width, height: source.height, referenceScale: origin.scale };
    }
  }
  cached = { deck: assets.deck.image, atlas };
  return atlas;
}

export function createBoostTexture() {
  const image = document.createElement('canvas');
  image.width = 256;
  image.height = 128;
  const context = image.getContext('2d')!;
  const metal = context.createLinearGradient(0, 0, 0, 128);
  metal.addColorStop(0, '#6a7562'); metal.addColorStop(0.12, '#1d2c24'); metal.addColorStop(0.85, '#203129'); metal.addColorStop(1, '#87916d');
  context.fillStyle = metal; context.fillRect(0, 0, 256, 128);
  context.strokeStyle = '#111c15'; context.lineWidth = 6; context.strokeRect(3, 3, 250, 122);
  context.strokeStyle = '#d6a251'; context.lineWidth = 2; context.strokeRect(10, 10, 236, 108);
  for (const x of [17, 239]) for (const y of [17, 111]) {
    context.fillStyle = '#bbac79'; context.beginPath(); context.arc(x, y, 3.5, 0, Math.PI * 2); context.fill();
  }
  context.shadowBlur = 12; context.shadowColor = '#ffaf38';
  context.strokeStyle = '#ffd07b'; context.lineWidth = 12; context.lineJoin = 'round';
  for (const x of [53, 113, 173]) {
    context.beginPath(); context.moveTo(x, 31); context.lineTo(x + 31, 64); context.lineTo(x, 97); context.stroke();
  }
  return image;
}