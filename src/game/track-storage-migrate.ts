/**
 * T1: Lossless migration from Storage Schema v1 to v2.
 * Preserves all unknown fields and properties for forward compatibility.
 */

import type { PlacedProp } from './track-builder-3d';

export type MeshRole = 'terrain' | 'decoration' | 'obstacle' | 'trigger';
export type ShadingMode = 'lit' | 'unlit';

export interface PlacedPropV2 extends PlacedProp {
  modelRef: string | null;
  meshRole: MeshRole | (string & {});
  shadingMode: ShadingMode | (string & {});
  customProps: Record<string, unknown>;
  material?: Record<string, unknown>;
  obstacle?: Record<string, unknown>;
  bakeRef?: string;
  [key: string]: unknown;
}

export interface TrackDocV2 {
  version: 2;
  savedAt: string;
  courseId?: string;
  props: PlacedPropV2[];
  groups: { id: string; name: string; pivot: 'centroid' | 'bounds' }[];
  assetsUsed: Record<string, { sha256: string; bytes: number; name: string }>;
  patchHash: string | null;
  [key: string]: unknown;
}

/**
 * Pure migration from v1 (or legacy array/fixtures) to TrackDocV2.
 * Idempotent: migrateV1toV2(migrateV1toV2(x)) deep-equals migrateV1toV2(x).
 */
export function migrateV1toV2(raw: unknown): TrackDocV2 {
  if (!raw || typeof raw !== 'object') {
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      props: [],
      groups: [],
      assetsUsed: {},
      patchHash: null,
    };
  }

  const obj = raw as Record<string, unknown>;

  // If already version 2, return cloned document preserving all properties
  if (obj.version === 2 && Array.isArray(obj.props)) {
    return structuredClone(obj) as TrackDocV2;
  }

  // Extract raw props array
  const rawProps: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray(obj.props)
      ? obj.props
      : [];

  const migratedProps: PlacedPropV2[] = rawProps.map((p) => {
    if (!p || typeof p !== 'object') {
      return {
        id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'unknown',
        name: 'Unknown Prop',
        x: 0, y: 0, z: 0,
        rotY: 0,
        scale: 1,
        alignToTrack: true,
        modelRef: null,
        meshRole: 'decoration',
        shadingMode: 'lit',
        customProps: {},
      };
    }

    const propObj = p as Record<string, unknown>;

    // Migrate shadingMode from v1 lit boolean if not set
    let shadingMode: ShadingMode | string = 'lit';
    if (typeof propObj.shadingMode === 'string') {
      shadingMode = propObj.shadingMode;
    } else if (propObj.lit === false) {
      shadingMode = 'unlit';
    }

    const meshRole = typeof propObj.meshRole === 'string' ? propObj.meshRole : 'decoration';
    const modelRef = typeof propObj.modelRef === 'string' ? propObj.modelRef : null;
    const customProps = (propObj.customProps && typeof propObj.customProps === 'object')
      ? (propObj.customProps as Record<string, unknown>)
      : {};

    return {
      ...structuredClone(propObj),
      modelRef,
      meshRole,
      shadingMode,
      customProps,
    } as PlacedPropV2;
  });

  // Preserve all extra top-level doc properties
  const { version: _oldVersion, props: _oldProps, ...extraDocProps } = obj;

  return {
    ...structuredClone(extraDocProps),
    version: 2,
    savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : new Date().toISOString(),
    courseId: typeof obj.courseId === 'string' ? obj.courseId : 'ridge',
    props: migratedProps,
    groups: Array.isArray(obj.groups) ? structuredClone(obj.groups as any) : [],
    assetsUsed: (obj.assetsUsed && typeof obj.assetsUsed === 'object') ? structuredClone(obj.assetsUsed as any) : {},
    patchHash: typeof obj.patchHash === 'string' ? obj.patchHash : null,
  };
}
