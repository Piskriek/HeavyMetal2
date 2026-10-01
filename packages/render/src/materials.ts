import * as THREE from 'three';
import type { RenderDesc } from './scene-sync';

type MaterialEntry = { readonly material: THREE.MeshStandardMaterial; refs: number };

class TextureCache {
  private readonly loader = new THREE.TextureLoader();
  private readonly textures = new Map<string, THREE.Texture>();

  constructor(private readonly resolveUrl: (path: string) => string) {}

  get(path: string, srgb: boolean, repeat: number): THREE.Texture | null {
    if (!path) return null;
    const safeRepeat = Math.max(0.01, repeat);
    const key = `${srgb ? 'srgb' : 'linear'}|${safeRepeat}|${path}`;
    const cached = this.textures.get(key);
    if (cached) return cached;
    const texture = this.loader.load(this.resolveUrl(path));
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(safeRepeat, safeRepeat);
    texture.anisotropy = 8;
    this.textures.set(key, texture);
    return texture;
  }

  dispose(): void {
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }
}

const materialKey = (desc: RenderDesc): string => JSON.stringify([
  desc.color, desc.roughness, desc.metalness, desc.albedo, desc.normal,
  desc.orm, desc.repeat, desc.normalStrength,
]);

export class MaterialPool {
  private readonly textures: TextureCache;
  private readonly entries = new Map<string, MaterialEntry>();

  constructor(resolveUrl: (path: string) => string) {
    this.textures = new TextureCache(resolveUrl);
  }

  acquire(desc: RenderDesc): { readonly key: string; readonly material: THREE.MeshStandardMaterial } {
    const key = materialKey(desc);
    const cached = this.entries.get(key);
    if (cached) {
      cached.refs += 1;
      return { key, material: cached.material };
    }
    const orm = this.textures.get(desc.orm, false, desc.repeat);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(desc.color),
      roughness: Math.min(1, Math.max(0, desc.roughness)),
      metalness: Math.min(1, Math.max(0, desc.metalness)),
      map: this.textures.get(desc.albedo, true, desc.repeat),
      normalMap: this.textures.get(desc.normal, false, desc.repeat),
      aoMap: orm,
      roughnessMap: orm,
      metalnessMap: orm,
      envMapIntensity: 0.85,
    });
    material.normalScale.set(desc.normalStrength, desc.normalStrength);
    this.entries.set(key, { material, refs: 1 });
    return { key, material };
  }

  release(key: string): void {
    const entry = this.entries.get(key);
    if (entry) entry.refs = Math.max(0, entry.refs - 1);
  }

  dispose(): void {
    for (const entry of this.entries.values()) entry.material.dispose();
    this.entries.clear();
    this.textures.dispose();
  }
}