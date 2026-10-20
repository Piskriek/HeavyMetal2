// ============================================================================
// File: packages/hudmath/src/toast-queue-and-compass.ts
// TICKET-18 Rest (POL-35, POL-44, POL-45, POL-46):
// Pure HUD state & math helpers:
// 1. POL-35: Title-Card Banner Hold Queue (`body[data-title-up]` holds EVERY
//    banner/toast in priority+FIFO order until the title card fades, not only
//    CANNOT PLACE).
// 2. POL-44: Driving Drift Badge (`DRIFT +deg°`), Compass Leak Bearings alongside
//    the Gate marker, and hiding `SyncWord` / suit sync gauge inside the 25 m
//    Moon Twin Gate dome.
// 3. POL-45 & POL-46: Responsive Build Drawer width below 1280 px (`100vw - 496px`,
//    528 px at 1024 px clearing the 200 px side stacks) and keeping the 104 px
//    bottom offset to clear the 76 px hotbar at bottom 24 px.
// ============================================================================

export type ToastKind =
  | 'cannot-place'
  | 'warning'
  | 'milestone'
  | 'recipe'
  | 'salvage'
  | 'info';

export interface ToastItem {
  readonly id: string;
  readonly kind: ToastKind;
  readonly text: string;
  readonly durationMs: number;
  readonly priority: number;
}

export interface ToastQueueState {
  readonly titleCardUp: boolean;
  readonly active: ToastItem | null;
  readonly remainingMs: number;
  readonly queue: readonly ToastItem[];
}

export const TOAST_DEFAULT_DURATION_MS: Readonly<Record<ToastKind, number>> = {
  'cannot-place': 1800,
  warning: 2400,
  milestone: 3200,
  recipe: 2800,
  salvage: 2200,
  info: 2200,
};

export const TOAST_PRIORITY: Readonly<Record<ToastKind, number>> = {
  'cannot-place': 100,
  warning: 90,
  milestone: 80,
  recipe: 70,
  salvage: 60,
  info: 50,
};

export function createToastQueueState(titleCardUp = false): ToastQueueState {
  return {
    titleCardUp,
    active: null,
    remainingMs: 0,
    queue: [],
  };
}

/**
 * POL-35: Enqueues a toast banner. When `titleCardUp` is true (`body[data-title-up]`),
 * EVERY banner is held in the queue (not only `CANNOT PLACE`) and none is lost or
 * overwritten while the act/area title card is visible.
 */
export function enqueueToast(
  state: ToastQueueState,
  input: {
    readonly id: string;
    readonly kind: ToastKind;
    readonly text: string;
    readonly durationMs?: number;
  },
): ToastQueueState {
  const item: ToastItem = {
    id: input.id,
    kind: input.kind,
    text: input.text,
    durationMs: input.durationMs ?? TOAST_DEFAULT_DURATION_MS[input.kind] ?? 2200,
    priority: TOAST_PRIORITY[input.kind] ?? 50,
  };

  // Deduplicate identical consecutive toast text in queue
  if (state.active && !state.titleCardUp && state.active.text === item.text && state.active.kind === item.kind) {
    return {
      ...state,
      remainingMs: item.durationMs,
    };
  }
  const existingIdx = state.queue.findIndex((q) => q.text === item.text && q.kind === item.kind);
  const baseQueue = existingIdx >= 0 ? state.queue.filter((_, idx) => idx !== existingIdx) : [...state.queue];

  // If title card is up, hold any currently active toast back at the front of the queue too
  if (state.titleCardUp) {
    const heldQueue = state.active
      ? [state.active, ...baseQueue, item]
      : [...baseQueue, item];
    heldQueue.sort((a, b) => b.priority - a.priority);
    return {
      titleCardUp: true,
      active: null,
      remainingMs: 0,
      queue: heldQueue,
    };
  }

  // If no toast is currently active, show immediately
  if (!state.active) {
    return {
      ...state,
      active: item,
      remainingMs: item.durationMs,
    };
  }

  // Queue behind the active toast, ordered by priority (preserving FIFO within equal priority)
  const nextQueue = [...baseQueue, item].sort((a, b) => b.priority - a.priority);
  return {
    ...state,
    queue: nextQueue,
  };
}

/**
 * POL-35: Updates whether the full-screen title card is currently up (`body[data-title-up]`).
 * When the title card rises, any active toast is paused and placed at the head of the queue.
 * When the title card fades (`titleCardUp = false`), the first queued toast immediately pops active.
 */
export function setTitleCardUp(state: ToastQueueState, titleCardUp: boolean): ToastQueueState {
  if (state.titleCardUp === titleCardUp) return state;
  if (titleCardUp) {
    const held = state.active ? [{ ...state.active, durationMs: Math.max(600, state.remainingMs) }, ...state.queue] : [...state.queue];
    return {
      titleCardUp: true,
      active: null,
      remainingMs: 0,
      queue: held,
    };
  }
  // Title card just faded: pop the highest-priority held toast
  const [first, ...rest] = state.queue;
  return {
    titleCardUp: false,
    active: first ?? null,
    remainingMs: first ? first.durationMs : 0,
    queue: rest,
  };
}

/**
 * POL-35: Advances the toast timer by `dtMs` milliseconds. While `titleCardUp` is true,
 * timers stay frozen so held banners never expire unseen behind the title card.
 */
export function tickToastQueue(state: ToastQueueState, dtMs: number): ToastQueueState {
  if (state.titleCardUp || !state.active) return state;
  const elapsed = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
  const rem = state.remainingMs - elapsed;
  if (rem > 0) {
    return { ...state, remainingMs: rem };
  }
  const [next, ...rest] = state.queue;
  return {
    titleCardUp: false,
    active: next ?? null,
    remainingMs: next ? next.durationMs : 0,
    queue: rest,
  };
}

// ---- POL-44: Driving Drift Badge, Compass Leak Bearings & 25 m Gate Dome Sync Hide

export const GATE_SAFE_DOME_RADIUS_M = 25;
export const DRIFT_MIN_SPEED_MPS = 3.5;
export const DRIFT_MIN_ANGLE_DEG = 12;

export interface DrivingDriftBadgeState {
  readonly speedKmh: number;
  readonly drifting: boolean;
  readonly driftDeg: number;
  readonly label: string | null;
}

/**
 * POL-44: Computes the vehicle speed and drift slip angle (degrees between the rover's
 * heading forward vector `(sin(yaw), cos(yaw))` and its actual ground velocity `(vx, vz)`).
 */
export function computeDrivingDriftBadge(
  vx: number,
  vz: number,
  headingYaw: number,
): DrivingDriftBadgeState {
  const speedMps = Math.hypot(vx, vz);
  const speedKmh = Math.round(speedMps * 3.6);
  if (!Number.isFinite(speedMps) || speedMps < DRIFT_MIN_SPEED_MPS) {
    return { speedKmh: Number.isFinite(speedKmh) ? speedKmh : 0, drifting: false, driftDeg: 0, label: null };
  }
  const moveYaw = Math.atan2(vx, vz);
  let diff = ((moveYaw - headingYaw) * 180) / Math.PI;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  const absDeg = Math.round(Math.abs(diff));
  const drifting = absDeg >= DRIFT_MIN_ANGLE_DEG;
  return {
    speedKmh,
    drifting,
    driftDeg: Math.round(diff),
    label: drifting ? `DRIFT ${absDeg}°` : null,
  };
}

export interface CompassLeakBearing {
  readonly site: number;
  readonly relativeDeg: number;
  readonly clampedDeg: number;
  readonly distanceM: number;
  readonly edge: boolean;
}

/**
 * Wraps an angle in degrees to `[-180, 180]`.
 */
export function wrapDegrees180(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * POL-44: Computes relative compass bearings (`-90..+90` strip projection + `edge` flag)
 * for active unsealed S-Space leaks relative to the player's eye `(eyeX, eyeZ)` and `facingYaw`.
 */
export function computeLeakCompassBearings(
  eyeX: number,
  eyeZ: number,
  facingYaw: number,
  leaks: readonly { readonly site: number; readonly x: number; readonly z: number; readonly sealed?: boolean }[],
): CompassLeakBearing[] {
  const out: CompassLeakBearing[] = [];
  for (const lk of leaks) {
    if (lk.sealed) continue;
    const dx = lk.x - eyeX;
    const dz = lk.z - eyeZ;
    const distanceM = Math.hypot(dx, dz);
    const targetYaw = Math.atan2(dx, -dz);
    const relativeDeg = wrapDegrees180(((targetYaw - facingYaw) * 180) / Math.PI);
    const clampedDeg = Math.max(-90, Math.min(90, relativeDeg));
    out.push({
      site: lk.site,
      relativeDeg,
      clampedDeg,
      distanceM,
      edge: Math.abs(relativeDeg) > 90,
    });
  }
  out.sort((a, b) => a.distanceM - b.distanceM);
  return out;
}

/**
 * POL-44: Returns true when the player stands inside the 25 m Moon Twin Gate dome
 * (or inside the 15 m starter shelter dome), hiding the suit sync gauge / SyncWord.
 */
export function isInsideGateSafeDome(
  eyeX: number,
  eyeZ: number,
  gate: { readonly x: number; readonly z: number },
  domeRadiusM = GATE_SAFE_DOME_RADIUS_M,
): boolean {
  const d = Math.hypot(eyeX - gate.x, eyeZ - gate.z);
  return Number.isFinite(d) && d <= domeRadiusM;
}

// ---- POL-45 & POL-46: Build Drawer Width Below 1280 px & 104 px Bottom Clearance

export const SIDE_STACK_CLEARANCE_PX = 496; // 2 * (200 px side stack + 48 px margin)
export const BUILD_DRAWER_BOTTOM_PX = 104;  // Clears 76 px hotbar at bottom 24 px + 4 px gap (POL-46 ruling)

export interface BuildDrawerLayoutMetrics {
  readonly maxWidthPx: number;
  readonly bottomPx: number;
  readonly cardsScrollHorizontally: boolean;
}

/**
 * POL-45 & POL-46: Computes the Build Drawer's responsive width and bottom offset.
 * At 1024 px viewport width, `maxWidthPx` is `1024 - 496 = 528 px` and cards scroll horizontally
 * so the drawer never overlaps the 200 px left/right HUD stacks. Bottom stays at `104 px` to clear
 * the 76 px hotbar at bottom 24 px.
 */
export function computeBuildDrawerLayout(viewportWidthPx: number): BuildDrawerLayoutMetrics {
  const vw = Number.isFinite(viewportWidthPx) && viewportWidthPx > 0 ? viewportWidthPx : 1280;
  const maxWidthPx = Math.max(320, Math.min(960, vw - SIDE_STACK_CLEARANCE_PX));
  return {
    maxWidthPx,
    bottomPx: BUILD_DRAWER_BOTTOM_PX,
    cardsScrollHorizontally: vw < 1280,
  };
}
