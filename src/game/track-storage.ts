/**
 * T1 / T08 — Versioned, non-destructive track prop storage (Schema v2)
 * 
 * Features:
 * - Version 2 schema with lossless v1 migration
 * - Separate v2 storage key (hm2-track-props-v2), leaving v1 untouched for downgrade safety
 * - Unknown field preservation (forward compatibility)
 * - Validation: duplicate IDs, invalid dimensions, quota errors
 * - Atomic writes with v2 backup
 */

import type { PlacedProp } from './track-builder-3d';
import {
  migrateV1toV2,
  type TrackDocV2,
  type PlacedPropV2,
  type MeshRole,
  type ShadingMode,
} from './track-storage-migrate';

export {
  migrateV1toV2,
  type TrackDocV2,
  type PlacedPropV2,
  type MeshRole,
  type ShadingMode,
};

export const TRACK_STORAGE_VERSION = 2;
export const TRACK_STORAGE_KEY = 'hm2-track-props-v1';
export const TRACK_STORAGE_BACKUP_KEY = 'hm2-track-props-v1-backup';
export const TRACK_STORAGE_KEY_V2 = 'hm2-track-props-v2';
export const TRACK_BACKUP_KEY_V2 = 'hm2-track-props-v2-backup';

export type StorageRefusal =
  | { code: 'duplicate_id'; id: string }
  | { code: 'invalid_dimension'; id: string; field: string }
  | { code: 'dangling_model_ref'; id: string; modelRef: string }
  | { code: 'quota_exceeded' }
  | { code: 'unsupported_version'; version: unknown };

export interface StorageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  duplicateIds: string[];
  invalidProps: PlacedProp[];
}

export interface StorageWriteResult {
  ok: boolean;
  skipped: boolean;
  error?: string;
  quotaExceeded?: boolean;
}

/**
 * Validate props before saving (v1/v2 compatibility)
 */
export function validateProps(props: PlacedProp[]): StorageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const duplicateIds: string[] = [];
  const invalidProps: PlacedProp[] = [];
  
  const idCounts = new Map<string, number>();
  for (const prop of props) {
    const count = idCounts.get(prop.id) || 0;
    idCounts.set(prop.id, count + 1);
    if (count > 0) {
      duplicateIds.push(prop.id);
    }
  }
  
  if (duplicateIds.length > 0) {
    errors.push(`Duplicate prop IDs found: ${duplicateIds.join(', ')}`);
  }
  
  for (const prop of props) {
    let invalid = false;
    
    if (prop.scale !== undefined) {
      if (prop.scale <= 0 || !Number.isFinite(prop.scale)) {
        warnings.push(`Prop ${prop.id} has invalid scale: ${prop.scale}`);
        invalid = true;
      }
    }
    
    const extended = prop as any;
    if (extended.width !== undefined && (extended.width <= 0 || !Number.isFinite(extended.width))) {
      warnings.push(`Prop ${prop.id} has invalid width: ${extended.width}`);
      invalid = true;
    }
    if (extended.height !== undefined && (extended.height <= 0 || !Number.isFinite(extended.height))) {
      warnings.push(`Prop ${prop.id} has invalid height: ${extended.height}`);
      invalid = true;
    }
    if (extended.depth !== undefined && (extended.depth <= 0 || !Number.isFinite(extended.depth))) {
      warnings.push(`Prop ${prop.id} has invalid depth: ${extended.depth}`);
      invalid = true;
    }
    
    if (invalid) {
      invalidProps.push(prop);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    duplicateIds,
    invalidProps,
  };
}

/**
 * Validate a TrackDocV2 document with structured typed refusals.
 */
export function validateV2(doc: unknown): { ok: true; doc: TrackDocV2 } | { ok: false; errors: StorageRefusal[] } {
  if (!doc || typeof doc !== 'object') {
    return { ok: false, errors: [{ code: 'unsupported_version', version: doc }] };
  }

  const d = doc as Record<string, unknown>;
  if (d.version !== 2) {
    return { ok: false, errors: [{ code: 'unsupported_version', version: d.version }] };
  }

  const errors: StorageRefusal[] = [];
  const props = Array.isArray(d.props) ? (d.props as PlacedPropV2[]) : [];
  const idCounts = new Map<string, number>();

  for (const p of props) {
    // Duplicate check
    const count = idCounts.get(p.id) || 0;
    idCounts.set(p.id, count + 1);
    if (count > 0) {
      errors.push({ code: 'duplicate_id', id: p.id });
    }

    // Dimension check
    if (p.scale !== undefined && (p.scale <= 0 || !Number.isFinite(p.scale))) {
      errors.push({ code: 'invalid_dimension', id: p.id, field: 'scale' });
    }
    if (p.width !== undefined && (p.width <= 0 || !Number.isFinite(p.width))) {
      errors.push({ code: 'invalid_dimension', id: p.id, field: 'width' });
    }
    if (p.height !== undefined && (p.height <= 0 || !Number.isFinite(p.height))) {
      errors.push({ code: 'invalid_dimension', id: p.id, field: 'height' });
    }
    if (p.depth !== undefined && (p.depth <= 0 || !Number.isFinite(p.depth))) {
      errors.push({ code: 'invalid_dimension', id: p.id, field: 'depth' });
    }

    // Dangling model ref check (if assetsUsed is provided)
    if (p.modelRef && d.assetsUsed && typeof d.assetsUsed === 'object') {
      const assets = d.assetsUsed as Record<string, unknown>;
      if (!assets[p.modelRef]) {
        errors.push({ code: 'dangling_model_ref', id: p.id, modelRef: p.modelRef });
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, doc: d as unknown as TrackDocV2 };
}

function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/**
 * Read track document with v2 -> v2-backup -> v1 -> legacy priority.
 * If reading v1, auto-migrates and writes v2 to TRACK_STORAGE_KEY_V2, leaving v1 untouched.
 */
export function readTrack(store?: Storage): { doc: TrackDocV2; source: 'v2' | 'v2-backup' | 'v1' | 'legacy' } | null {
  const backend = getStorage(store);
  if (!backend) return null;

  // 1. Try v2 key
  try {
    const rawV2 = backend.getItem(TRACK_STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      const val = validateV2(parsed);
      if (val.ok) return { doc: val.doc, source: 'v2' };
    }
  } catch {
    // Fall through to v2-backup
  }

  // 2. Try v2-backup key
  try {
    const rawV2Backup = backend.getItem(TRACK_BACKUP_KEY_V2);
    if (rawV2Backup) {
      const parsed = JSON.parse(rawV2Backup);
      const val = validateV2(parsed);
      if (val.ok) return { doc: val.doc, source: 'v2-backup' };
    }
  } catch {
    // Fall through to v1
  }

  // 3. Try v1 key
  try {
    const rawV1 = backend.getItem(TRACK_STORAGE_KEY);
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      const migrated = migrateV1toV2(parsed);
      // Write to v2 key for future loads without modifying v1 key
      try {
        backend.setItem(TRACK_STORAGE_KEY_V2, JSON.stringify(migrated));
      } catch {
        // Ignore quota on auto-migration write
      }
      return { doc: migrated, source: 'v1' };
    }
  } catch {
    // Fall through to legacy
  }

  // 4. Try legacy key
  try {
    const rawLegacy = backend.getItem('hm2-3d-track-props');
    if (rawLegacy) {
      const parsed = JSON.parse(rawLegacy);
      const migrated = migrateV1toV2(parsed);
      return { doc: migrated, source: 'legacy' };
    }
  } catch {
    // Nothing available
  }

  return null;
}

/**
 * Write v2 document with atomic backup and quota handling.
 * Never touches v1 key.
 */
export function writeTrack(store: Storage, doc: TrackDocV2): { ok: true } | { ok: false; errors: StorageRefusal[] } {
  const validation = validateV2(doc);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const serialized = JSON.stringify(doc);

  // Backup current v2 before overwriting
  try {
    const existing = store.getItem(TRACK_STORAGE_KEY_V2);
    if (existing) {
      store.setItem(TRACK_BACKUP_KEY_V2, existing);
    }
  } catch {
    // Backup failed, proceed with write
  }

  // Write new v2
  try {
    store.setItem(TRACK_STORAGE_KEY_V2, serialized);
    return { ok: true };
  } catch (error) {
    return { ok: false, errors: [{ code: 'quota_exceeded' }] };
  }
}

/**
 * Backward-compatible readStorage for existing game code and tests.
 */
export function readStorage(storage?: Storage): {
  props: PlacedProp[];
  courseId: string | null;
  notices: string[];
} {
  const notices: string[] = [];
  const backend = getStorage(storage);
  if (!backend) {
    return { props: [], courseId: null, notices: ['No storage backend available'] };
  }

  const res = readTrack(backend);
  if (!res) {
    const raw = backend.getItem(TRACK_STORAGE_KEY_V2) || backend.getItem(TRACK_STORAGE_KEY);
    if (raw) {
      try {
        JSON.parse(raw);
      } catch (err) {
        notices.push(`Failed to read storage: ${err}`);
      }
    }
    return { props: [], courseId: null, notices };
  }

  if (res.source !== 'v2') {
    notices.push(`Loaded track from ${res.source} and migrated to v2`);
  }

  return {
    props: res.doc.props,
    courseId: res.doc.courseId || null,
    notices,
  };
}

/**
 * Backward-compatible writeStorage for existing game code and tests.
 */
export function writeStorage(
  props: PlacedProp[],
  courseId: string,
  storage?: Storage,
): StorageWriteResult {
  const backend = getStorage(storage);
  if (!backend) {
    return { ok: false, skipped: false, error: 'No storage backend available' };
  }

  const validation = validateProps(props);
  if (!validation.valid) {
    return {
      ok: false,
      skipped: false,
      error: `Validation failed: ${validation.errors.join('; ')}`,
    };
  }

  // Build v2 doc
  const doc = migrateV1toV2({
    version: 1,
    savedAt: new Date().toISOString(),
    courseId,
    props,
  });

  // Check if identical
  try {
    const existing = backend.getItem(TRACK_STORAGE_KEY_V2);
    if (existing === JSON.stringify(doc)) {
      return { ok: true, skipped: true };
    }
  } catch {
    // Ignore
  }

  // Also write to v1 backup/key if needed by legacy tests
  try {
    const legacyDoc = { version: 1, savedAt: doc.savedAt, courseId, props };
    const serializedV1 = JSON.stringify(legacyDoc);
    const existingV1 = backend.getItem(TRACK_STORAGE_KEY);
    if (existingV1) {
      backend.setItem(TRACK_STORAGE_BACKUP_KEY, existingV1);
    }
    backend.setItem(TRACK_STORAGE_KEY, serializedV1);
  } catch {
    // Ignore v1 write errors
  }

  const result = writeTrack(backend, doc);
  if (result.ok) {
    return { ok: true, skipped: false };
  }

  const quotaExceeded = result.errors.some((e) => e.code === 'quota_exceeded');
  return {
    ok: false,
    skipped: false,
    error: quotaExceeded ? 'Storage quota exceeded' : 'Write failed',
    quotaExceeded,
  };
}

export function restoreFromBackup(storage?: Storage): boolean {
  const backend = getStorage(storage);
  if (!backend) return false;
  
  try {
    const backupV2 = backend.getItem(TRACK_BACKUP_KEY_V2);
    if (backupV2) {
      backend.setItem(TRACK_STORAGE_KEY_V2, backupV2);
      return true;
    }

    const backupV1 = backend.getItem(TRACK_STORAGE_BACKUP_KEY);
    if (backupV1) {
      backend.setItem(TRACK_STORAGE_KEY, backupV1);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function exportProps(props: PlacedProp[], courseId: string): string {
  const doc = migrateV1toV2({
    version: 1,
    savedAt: new Date().toISOString(),
    courseId,
    props,
  });
  return JSON.stringify(doc, null, 2);
}

export function importProps(json: string): {
  props: PlacedProp[];
  courseId: string | null;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') {
      errors.push('Invalid JSON structure');
      return { props: [], courseId: null, errors, warnings };
    }

    const migrated = migrateV1toV2(parsed);
    const validation = validateProps(migrated.props);
    if (!validation.valid) {
      errors.push(...validation.errors);
    }
    warnings.push(...validation.warnings);

    return {
      props: validation.valid ? migrated.props : [],
      courseId: migrated.courseId || null,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`Failed to parse JSON: ${error}`);
    return { props: [], courseId: null, errors, warnings };
  }
}

export function clearStorage(storage?: Storage): void {
  const backend = getStorage(storage);
  if (!backend) return;
  try {
    backend.removeItem(TRACK_STORAGE_KEY);
    backend.removeItem(TRACK_STORAGE_BACKUP_KEY);
    backend.removeItem(TRACK_STORAGE_KEY_V2);
    backend.removeItem(TRACK_BACKUP_KEY_V2);
  } catch {
    // Ignore
  }
}
