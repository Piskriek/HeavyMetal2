// ============================================================================
// File: apps/web/src/studio/scene-tab-data.ts
// Pure data types, starter scenes, and serialization helpers for Scene layouts (POL-87/93).
// Does NOT import CSS so Node unit tests can import this safely.
// ============================================================================

import { round3 } from './studio-data';
import type { Transform } from './studio-viewport';

export interface SceneItem {
  readonly id: string;
  readonly assetId: string;
  readonly t: Transform;
}

export interface SceneDoc {
  readonly name: string;
  readonly items: readonly SceneItem[];
}

/** Saved layouts key in localStorage. */
export const LAYOUTS_KEY = 'studio.scene-layouts';

export function normalizeTransform(raw: unknown, label: string): Transform {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${label}: transform "t" must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const off = obj.offset;
  if (
    !Array.isArray(off) ||
    off.length !== 3 ||
    typeof off[0] !== 'number' ||
    typeof off[1] !== 'number' ||
    typeof off[2] !== 'number' ||
    !Number.isFinite(off[0]) ||
    !Number.isFinite(off[1]) ||
    !Number.isFinite(off[2])
  ) {
    throw new Error(`${label}: transform offset must be a 3-number tuple [x, y, z]`);
  }
  const yaw = obj.yaw;
  if (typeof yaw !== 'number' || !Number.isFinite(yaw)) {
    throw new Error(`${label}: transform yaw must be a finite number`);
  }
  const scale = obj.scale;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) {
    throw new Error(`${label}: transform scale must be a positive finite number`);
  }
  return {
    offset: [round3(off[0]), round3(off[1]), round3(off[2])],
    yaw: round3(yaw),
    scale: round3(scale),
  };
}

export function validateSceneDoc(input: unknown): SceneDoc {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('SceneDoc must be a JSON object');
  }
  const obj = input as Record<string, unknown>;
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    throw new Error('SceneDoc "name" must be a non-empty string');
  }
  if (!Array.isArray(obj.items)) {
    throw new Error('SceneDoc "items" must be an array');
  }

  const seenIds = new Set<string>();
  const items: SceneItem[] = obj.items.map((raw, idx) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`items[${idx}] must be an object`);
    }
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || r.id.trim().length === 0) {
      throw new Error(`items[${idx}].id must be a non-empty string`);
    }
    if (typeof r.assetId !== 'string' || r.assetId.trim().length === 0) {
      throw new Error(`items[${idx}].assetId must be a non-empty string`);
    }
    const id = r.id.trim();
    if (seenIds.has(id)) {
      throw new Error(`Duplicate SceneItem id "${id}"`);
    }
    seenIds.add(id);
    return {
      id,
      assetId: r.assetId.trim(),
      t: normalizeTransform(r.t, `items[${idx}]`),
    };
  });

  return {
    name: obj.name.trim(),
    items,
  };
}

/**
 * Pure helper (TICKET-08b Item B):
 * Validates and serializes a `SceneDoc` to canonical 2-space indented JSON with a trailing newline.
 */
export function serializeScene(doc: SceneDoc): string {
  const clean = validateSceneDoc(doc);
  return `${JSON.stringify(clean, null, 2)}\n`;
}

/**
 * Pure helper (TICKET-08b Item B):
 * Parses and validates a `SceneDoc` from a JSON string (or raw object).
 * Throws an `Error` if the input is malformed or fails schema validation.
 */
export function parseScene(input: string | unknown): SceneDoc {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    if (input.trim().length === 0) {
      throw new Error('Empty scene JSON string');
    }
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      throw new Error(`Invalid scene JSON: ${(err as Error).message}`);
    }
  }
  return validateSceneDoc(parsed);
}

export const STARTER_SCENES: readonly SceneDoc[] = [
  {
    name: 'Outpost Production Pad',
    items: [
      { id: 'mill-1', assetId: 'mill', t: { offset: [-3.5, 0, 0], yaw: 0, scale: 1 } },
      { id: 'press-1', assetId: 'press-frame', t: { offset: [3.5, 0, 0], yaw: 90, scale: 1 } },
      { id: 'water-1', assetId: 'watermaker', t: { offset: [0, 0, -5.5], yaw: 0, scale: 1 } },
    ],
  },
  {
    name: 'Rover Bay Inspection',
    items: [
      { id: 'scout-1', assetId: 'scout-body', t: { offset: [-2.5, 0, 0], yaw: 20, scale: 1 } },
      { id: 'hauler-1', assetId: 'hauler-body', t: { offset: [2.8, 0, 0], yaw: -15, scale: 1 } },
    ],
  },
];
