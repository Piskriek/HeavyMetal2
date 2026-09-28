/**
 * IF-MATERIAL-SHADING: MaterialCache provides refcounted sharing of Three.js materials.
 * Dynamically updates biome tint colors in place without triggering shader recompiles.
 */

import * as THREE from 'three';
import {
  type MaterialDescriptor,
  materialKey,
  effectiveColor,
  normalizeDescriptor,
} from './material-descriptor';

interface CacheEntry {
  material: THREE.Material;
  descriptor: MaterialDescriptor;
  refCount: number;
}

export class MaterialCache {
  private cache = new Map<string, CacheEntry>();
  private currentBiome = 'ridge';
  private totalAcquires = 0;

  acquire(desc: MaterialDescriptor, biomeKey = this.currentBiome): THREE.Material {
    this.totalAcquires++;
    const norm = normalizeDescriptor(desc);
    const key = materialKey(norm, biomeKey);

    let entry = this.cache.get(key);
    if (!entry) {
      const mat = this.createMaterial(norm, biomeKey);
      entry = { material: mat, descriptor: norm, refCount: 1 };
      this.cache.set(key, entry);
      return mat;
    }

    entry.refCount++;
    return entry.material;
  }

  release(desc: MaterialDescriptor, biomeKey = this.currentBiome): void {
    const norm = normalizeDescriptor(desc);
    const key = materialKey(norm, biomeKey);

    const entry = this.cache.get(key);
    if (!entry) return;

    entry.refCount--;
    if (entry.refCount <= 0) {
      entry.material.dispose();
      this.cache.delete(key);
    }
  }

  setBiome(biomeKey: string): void {
    this.currentBiome = biomeKey;

    // Mutate colors in-place without altering material.version to avoid GPU shader recompilation
    for (const entry of this.cache.values()) {
      const [r, g, b] = effectiveColor(entry.descriptor, biomeKey);
      const mat = entry.material;

      if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial || (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
        (mat as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial).color.setRGB(r, g, b);
      }
    }
  }

  get stats(): { liveMaterials: number; totalAcquires: number } {
    return {
      liveMaterials: this.cache.size,
      totalAcquires: this.totalAcquires,
    };
  }

  clear(): void {
    for (const entry of this.cache.values()) {
      entry.material.dispose();
    }
    this.cache.clear();
  }

  private createMaterial(desc: MaterialDescriptor, biomeKey: string): THREE.Material {
    const [r, g, b] = effectiveColor(desc, biomeKey);
    const color = new THREE.Color(r, g, b);
    const side = desc.doubleSided ? THREE.DoubleSide : THREE.FrontSide;

    if (desc.shadingMode === 'unlit') {
      return new THREE.MeshBasicMaterial({
        color,
        side,
        toneMapped: true,
      });
    }

    return new THREE.MeshStandardMaterial({
      color,
      roughness: desc.roughness,
      metalness: desc.metalness,
      side,
    });
  }
}
