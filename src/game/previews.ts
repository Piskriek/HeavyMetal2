import type { GameAssets } from './assets';
import { buildModelAtlas, type ModelName } from './model-atlas';

export function createAssemblyPreviews(assets: Pick<GameAssets, 'deck'>) {
  const models = buildModelAtlas(assets).range;
  const previews = {} as Record<ModelName, string>;
  for (const name of Object.keys(models) as ModelName[]) {
    const layers = [...models[name].layers].sort((a, b) => b.depth - a.depth);
    const left = Math.min(...layers.map((layer) => layer.x));
    const top = Math.min(...layers.map((layer) => layer.y));
    const width = Math.max(...layers.map((layer) => layer.x + layer.width)) - left;
    const height = Math.max(...layers.map((layer) => layer.y + layer.height)) - top;
    const canvas = document.createElement('canvas');
    const scale = 620 / Math.max(width, height);
    canvas.width = Math.ceil(width * scale) + 24;
    canvas.height = Math.ceil(height * scale) + 24;
    const context = canvas.getContext('2d')!;
    context.setTransform(scale, 0, 0, scale, 12 - left * scale, 12 - top * scale);
    context.imageSmoothingQuality = 'high';
    for (const layer of layers) context.drawImage(layer.image, layer.x, layer.y, layer.width, layer.height);
    previews[name] = canvas.toDataURL('image/png');
  }
  return previews;
}