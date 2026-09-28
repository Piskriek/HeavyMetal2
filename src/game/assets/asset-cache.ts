/**
 * IF-MODEL-IMPORT: AssetCache manages runtime GPU objects with reference counting.
 * When the last reference is released, geometry, materials, and textures are disposed.
 */

import * as THREE from 'three';

interface CachedEntry {
  root: THREE.Object3D;
  refCount: number;
}

export class AssetCache {
  private cache = new Map<string, CachedEntry>();

  acquire(assetId: string, factory: () => THREE.Object3D): THREE.Object3D {
    let entry = this.cache.get(assetId);
    if (!entry) {
      const root = factory();
      entry = { root, refCount: 1 };
      this.cache.set(assetId, entry);
      return root.clone(true);
    }

    entry.refCount++;
    return entry.root.clone(true);
  }

  release(assetId: string): void {
    const entry = this.cache.get(assetId);
    if (!entry) return;

    entry.refCount--;
    if (entry.refCount <= 0) {
      this.disposeObject(entry.root);
      this.cache.delete(assetId);
    }
  }

  get stats(): { assets: number; geometries: number; textures: number } {
    let geometries = 0;
    let textures = 0;

    for (const entry of this.cache.values()) {
      entry.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) geometries++;
          if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of mats) {
              if ((mat as any).map) textures++;
            }
          }
        }
      });
    }

    return {
      assets: this.cache.size,
      geometries,
      textures,
    };
  }

  clear(): void {
    for (const entry of this.cache.values()) {
      this.disposeObject(entry.root);
    }
    this.cache.clear();
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            if ((mat as any).map) (mat as any).map.dispose();
            mat.dispose();
          }
        }
      }
    });
  }
}
