import type { GameAssets } from './assets';
import type { Material } from './geometry';

export interface Materials {
  timber: Material;
  timberDark: Material;
  endGrain: Material;
  iron: Material;
  brass: Material;
  rope: Material;
  leather: Material;
}

const cache = new WeakMap<HTMLImageElement, Materials>();

export function createMaterials(assets: Pick<GameAssets, 'deck'>): Materials {
  const wood = assets.deck;
  const cached = cache.get(wood.image);
  if (cached) return cached;
  const timberTexture = (x: number, width: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;
    context.imageSmoothingQuality = 'high';
    context.drawImage(wood.image, wood.width * x, wood.height * 0.19, wood.width * width, wood.height * 0.52, 0, 0, 128, 256);
    return canvas;
  };
  const metal = document.createElement('canvas');
  metal.width = 128;
  metal.height = 128;
  const context = metal.getContext('2d')!;
  const reflection = context.createLinearGradient(0, 0, 128, 128);
  reflection.addColorStop(0, '#25362e');
  reflection.addColorStop(0.4, '#617369');
  reflection.addColorStop(0.55, '#364740');
  reflection.addColorStop(1, '#15221d');
  context.fillStyle = reflection;
  context.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 170; i++) {
    const x = (i * 47.17) % 128;
    const y = (i * 31.91) % 128;
    context.fillStyle = i % 3 ? '#d4e2d114' : '#050d0833';
    context.fillRect(x, y, 1 + i % 9, 0.6);
  }
  const timber: Material = { color: '#926039', image: timberTexture(0.275, 0.19), crop: { x: 0, y: 0, width: 128, height: 256 }, edge: '#271b1170' };
  const result: Materials = {
    timber,
    timberDark: { ...timber, image: timberTexture(0.06, 0.12) },
    endGrain: { color: '#805434', edge: '#d49a5552' },
    iron: { color: '#45564d', image: metal, crop: { x: 0, y: 0, width: 128, height: 128 }, edge: '#c4cdb735' },
    brass: { color: '#c19553', edge: '#e5c78a70' },
    rope: { color: '#b7a378', edge: '#362c1950' },
    leather: { color: '#78462b', edge: '#d09c5f52' },
  };
  cache.set(wood.image, result);
  return result;
}