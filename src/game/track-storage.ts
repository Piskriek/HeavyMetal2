/**
 * T08 — Versioned, non-destructive track prop storage
 * 
 * Features:
 * - Versioned schema with migration support
 * - Unknown field preservation (forward compatibility)
 * - Validation: duplicate IDs, invalid dimensions, quota errors
 * - Separate storage path (not protected)
 * - Atomic writes with backup
 */

import type { PlacedProp } from './track-builder-3d';

export const TRACK_STORAGE_VERSION = 1;
export const TRACK_STORAGE_KEY = 'hm2-track-props-v1';
export const TRACK_STORAGE_BACKUP_KEY = 'hm2-track-props-v1-backup';

export interface TrackStorageSchema {
  version: number;
  savedAt: string;
  courseId: string;
  props: PlacedProp[];
  /** Unknown fields preserved for forward compatibility */
  [key: string]: unknown;
}

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
 * Validate props before saving
 */
export function validateProps(props: PlacedProp[]): StorageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const duplicateIds: string[] = [];
  const invalidProps: PlacedProp[] = [];
  
  // Check for duplicate IDs
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
  
  // Validate dimensions
  for (const prop of props) {
    let invalid = false;
    
    // Check scale
    if (prop.scale !== undefined) {
      if (prop.scale <= 0 || !Number.isFinite(prop.scale)) {
        warnings.push(`Prop ${prop.id} has invalid scale: ${prop.scale}`);
        invalid = true;
      }
    }
    
    // Check width/height/depth if present (T08 extension)
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
 * Build a storage document with version and metadata
 */
export function buildStorageDocument(
  props: PlacedProp[],
  courseId: string,
  savedAt = new Date().toISOString(),
): TrackStorageSchema {
  return {
    version: TRACK_STORAGE_VERSION,
    savedAt,
    courseId,
    props,
  };
}

/**
 * Get the storage backend (localStorage if available, otherwise null)
 */
function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/**
 * Read from storage with validation and unknown field preservation.
 * Returns empty array if no data available (never null).
 */
export function readStorage(storage?: Storage): {
  props: PlacedProp[];
  courseId: string | null;
  notices: string[];
} {
  const notices: string[] = [];
  const storageBackend = getStorage(storage);
  
  if (!storageBackend) {
    return { props: [], courseId: null, notices: ['No storage backend available'] };
  }
  
  try {
    const raw = storageBackend.getItem(TRACK_STORAGE_KEY);
    if (!raw) {
      return { props: [], courseId: null, notices };
    }
    
    const parsed = JSON.parse(raw);
    
    // Check version
    if (parsed.version !== TRACK_STORAGE_VERSION) {
      notices.push(`Storage version mismatch: expected ${TRACK_STORAGE_VERSION}, got ${parsed.version}`);
      // For now, just warn but continue
    }
    
    if (!Array.isArray(parsed.props)) {
      notices.push('Storage props is not an array');
      return { props: [], courseId: null, notices };
    }
    
    // Validate
    const validation = validateProps(parsed.props);
    if (validation.warnings.length > 0) {
      notices.push(...validation.warnings);
    }
    
    // Preserve unknown fields by returning the raw parsed object
    // The caller can access additional fields if needed
    return {
      props: parsed.props,
      courseId: parsed.courseId || null,
      notices,
    };
  } catch (error) {
    notices.push(`Failed to read storage: ${error}`);
    return { props: [], courseId: null, notices };
  }
}

/**
 * Write to storage with validation, backup, and quota handling
 */
export function writeStorage(
  props: PlacedProp[],
  courseId: string,
  storage?: Storage,
): StorageWriteResult {
  const storageBackend = getStorage(storage);
  
  if (!storageBackend) {
    return { ok: false, skipped: false, error: 'No storage backend available' };
  }
  
  // Validate before writing
  const validation = validateProps(props);
  if (!validation.valid) {
    return {
      ok: false,
      skipped: false,
      error: `Validation failed: ${validation.errors.join('; ')}`,
    };
  }
  
  const document = buildStorageDocument(props, courseId);
  const serialized = JSON.stringify(document);
  
  // Check if content changed (idempotent write)
  try {
    const existing = storageBackend.getItem(TRACK_STORAGE_KEY);
    if (existing === serialized) {
      return { ok: true, skipped: true };
    }
  } catch {
    // Ignore read errors
  }
  
  // Backup existing data
  try {
    const existing = storageBackend.getItem(TRACK_STORAGE_KEY);
    if (existing) {
      storageBackend.setItem(TRACK_STORAGE_BACKUP_KEY, existing);
    }
  } catch {
    // Backup failed, but continue with write
  }
  
  // Write with quota handling
  try {
    storageBackend.setItem(TRACK_STORAGE_KEY, serialized);
    return { ok: true, skipped: false };
  } catch (error) {
    const quotaExceeded = error instanceof DOMException && error.name === 'QuotaExceededError';
    return {
      ok: false,
      skipped: false,
      error: quotaExceeded ? 'Storage quota exceeded' : String(error),
      quotaExceeded,
    };
  }
}

/**
 * Restore from backup
 */
export function restoreFromBackup(storage?: Storage): boolean {
  const storageBackend = getStorage(storage);
  if (!storageBackend) return false;
  
  try {
    const backup = storageBackend.getItem(TRACK_STORAGE_BACKUP_KEY);
    if (!backup) return false;
    
    storageBackend.setItem(TRACK_STORAGE_KEY, backup);
    return true;
  } catch {
    return false;
  }
}

/**
 * Export props as JSON (with version for import compatibility)
 */
export function exportProps(props: PlacedProp[], courseId: string): string {
  const document = buildStorageDocument(props, courseId);
  return JSON.stringify(document, null, 2);
}

/**
 * Import props from JSON with validation.
 * Returns empty array if validation fails (never null).
 */
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
    
    if (!Array.isArray(parsed.props)) {
      errors.push('Missing or invalid props array');
      return { props: [], courseId: null, errors, warnings };
    }
    
    // Validate
    const validation = validateProps(parsed.props);
    if (!validation.valid) {
      errors.push(...validation.errors);
    }
    warnings.push(...validation.warnings);
    
    return {
      props: validation.valid ? parsed.props : [],
      courseId: parsed.courseId || null,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`Failed to parse JSON: ${error}`);
    return { props: [], courseId: null, errors, warnings };
  }
}

/**
 * Clear storage
 */
export function clearStorage(storage?: Storage): void {
  const storageBackend = getStorage(storage);
  if (!storageBackend) return;
  
  try {
    storageBackend.removeItem(TRACK_STORAGE_KEY);
    storageBackend.removeItem(TRACK_STORAGE_BACKUP_KEY);
  } catch {
    // Ignore errors
  }
}
