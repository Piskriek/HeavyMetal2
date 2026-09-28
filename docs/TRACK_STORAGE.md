# T08: Non-Destructive Feature-Prop Storage and Builder Authoring

## Overview

T08 introduces versioned, non-destructive storage for track props with forward-compatible
unknown-field preservation, input validation, quota handling, and new authoring controls.

## Architecture

### Storage Schema (`src/game/track-storage.ts`)

The storage module provides a versioned document format:

```typescript
interface TrackStorageSchema {
  version: number;        // Currently 1
  savedAt: string;        // ISO timestamp
  courseId: string;       // Active course
  props: PlacedProp[];    // Placed props with optional authoring fields
  [key: string]: unknown; // Unknown fields preserved
}
```

**Storage Keys:**
- Primary: `hm2-track-props-v1` (separate from protected path)
- Backup: `hm2-track-props-v1-backup`

### Extended PlacedProp Interface

```typescript
interface PlacedProp {
  // Core fields (unchanged)
  id: string;
  type: string;
  name: string;
  x: number; y: number; z: number;
  rotY: number;
  scale: number;
  alignToTrack: boolean;
  
  // T08 optional authoring fields
  width?: number;         // Explicit width override (world units)
  height?: number;        // Explicit height override (world units)
  depth?: number;         // Explicit depth override (world units)
  visible?: boolean;      // Visibility toggle (H key)
  authoringNotes?: string; // Optional metadata
  
  // Forward compatibility
  [key: string]: unknown;
}
```

### Scale Convention

**Critical**: Scale and explicit dimensions are mutually exclusive to prevent double-application.

```typescript
getEffectiveDimensions(prop: PlacedProp): { width, height, depth } {
  if (prop.width !== undefined) {
    // Explicit dimensions ARE the final size (no scale applied)
    return { width: prop.width, height: prop.height, depth: prop.depth };
  } else {
    // Fallback: default * scale
    return {
      width: def.defaultWidth * prop.scale,
      height: def.defaultHeight * prop.scale,
      depth: def.defaultDepth * prop.scale,
    };
  }
}
```

## Validation

### Input Checks

1. **Duplicate IDs**: Counted via Map, rejected if count > 0
2. **Invalid Dimensions**: scale/width/height/depth must be positive and finite
3. **Quota Errors**: Caught as `DOMException` with `name='QuotaExceededError'`

### Write Flow

```
1. validateProps() → reject if errors
2. buildStorageDocument() → add version + metadata
3. Backup existing data → hm2-track-props-v1-backup
4. Write to primary key
5. On quota error → restoreFromBackup()
```

## New Prop Categories

### Powerups (`category: 'powerup'`)

Procedural gameplay pickups with `isPowerup: true` flag:
- Speed Boost Pickup
- Shield Generator
- Missile Crate
- Jump Pad Platform
- Repair Kit

### Barriers (`category: 'barrier'`)

Hazardous obstacles with `isBarrier: true` flag:
- Spiked Barrier Wall
- Electric Fence
- Fire Pit Trap
- Rock Slide Zone
- Mine Field

## Visibility Controls

### H Key Toggle

```typescript
builder.toggleVisibility()  // Toggle selected props
builder.setVisibility(true/false)  // Explicit show/hide
builder.isPropVisible(prop)  // Check visibility
```

### Raycast Exclusion

Hidden props retain selection identity but are excluded from fresh raycasts:

```typescript
raycastProp(clientX, clientY, canvas) {
  // Filter invisible props from raycast targets
  const objects = propObjects.entries()
    .filter(([id]) => props.find(p => p.id === id)?.visible !== false)
    .map(([, obj]) => obj);
  
  // Screen-space fallback also skips invisible
  for (const prop of placedProps) {
    if (prop.visible === false) continue;
    // ... proximity check
  }
}
```

## Runtime State Stripping

Before serialization, runtime-only fields are removed:

```typescript
stripRuntimeState(props: PlacedProp[]): PlacedProp[] {
  return props.map(p => {
    const cleaned = { ...p };
    delete cleaned._runtime;
    delete cleaned._pickupCollected;
    delete cleaned._pickupRespawn;
    delete cleaned._runtimeState;
    return cleaned;
  });
}
```

## Import/Export

### Export Format

```json
{
  "version": 1,
  "savedAt": "2026-09-23T...",
  "courseId": "ridge",
  "props": [...]
}
```

### Import Compatibility

`importJson()` accepts both formats:
- **Versioned document**: `{ version, props, courseId }`
- **Legacy plain array**: `[prop1, prop2, ...]`

## Acceptance Criteria

- [x] Synthetic legacy fixtures round-trip without losing unknown fields
- [x] Failed/quota-interrupted saves preserve the last valid feature version
- [x] Duplicate IDs and invalid dimensions rejected
- [x] Scale and dimensions are not applied twice
- [x] Runtime pickup state is not serialized
- [x] No new writer targets the protected path

## Testing

**Test Suite**: `tests/track-storage.test.ts` (30 tests)

Coverage:
- Versioned schema and unknown-field preservation
- Validation (duplicate IDs, invalid dimensions, quota errors)
- Quota handling and backup restoration
- Runtime state stripping
- Import/export (versioned + legacy formats)
- Builder integration (visibility, dimensions, categories)

## API Reference

### Storage Functions

```typescript
validateProps(props: PlacedProp[]): StorageValidationResult
writeStorage(props, courseId, storage?): StorageWriteResult
readStorage(storage?): { props, courseId, notices }
restoreFromBackup(storage?): boolean
exportProps(props, courseId): string
importProps(json): { props, courseId, errors, warnings }
clearStorage(storage?): void
```

### Builder Methods

```typescript
// Visibility
toggleVisibility(): void
setVisibility(visible: boolean): void
isPropVisible(prop: PlacedProp): boolean

// Dimensions
getEffectiveDimensions(prop: PlacedProp): { width, height, depth }
setSelectedDimensions(updates: { width?, height?, depth? }): void
clearSelectedDimensions(): void
```

## Files

- `src/game/track-storage.ts` — Versioned storage module
- `src/game/track-builder-3d.ts` — Extended with T08 features
- `tests/track-storage.test.ts` — 30 T08 tests
- `docs/TRACK_STORAGE.md` — This document

## Migration Notes

No migration required. The storage module:
1. Reads from new key `hm2-track-props-v1`
2. Falls back to legacy `hm2-3d-track-props` if empty
3. Falls back to backup `hm2-3d-track-props-backup-latest` if still empty
4. Bootstraps with `DEFAULT_TRACK_PROPS` if all empty

Existing data is preserved and gradually migrated as props are saved.
