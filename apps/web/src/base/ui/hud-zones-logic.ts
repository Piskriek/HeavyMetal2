// The HUD's nine zones, as pure logic (TASK-25, Argo's plan 16 and reply 25). No DOM, no clock: every function takes
// the time it needs, so the same inputs always give the same screen. The React side is hud-zones.tsx.

/** The nine fixed regions of the screen. Every overlay mounts into one of them and carries its name as data-hud-zone. */
export const HUD_ZONES = [
  'top-left', // the quest step: title, one or two sentences, the key hint
  'top-centre', // the compass ribbon and the sync state word
  'title', // the location and stage title cards, dropped at 72 px below the top
  'top-right', // the four floats, the stage badge, the branch chip and comms
  'centre', // the reticle, its raycast prompt and CANNOT PLACE
  'subtitle', // the radio subtitle, bottom 108 px, never above 160 px
  'bottom-centre', // the hotbar, with the build drawer above it
  'bottom-left', // the suit's sync gauge; speed and drift when driving
  'bottom-right', // the tool, the gun ammo, the resource ticker and the pickup toasts
] as const;
export type HudZone = (typeof HUD_ZONES)[number];

/** The reticle's clear zone: a square of 48 px centred on the crosshair (plus or minus 24 px). A zone box may not reach into it. */
export const RETICLE_CLEAR_HALF_PX = 24;
/** A title card holds the other banners for this long (plan 16: "suppress any secondary banner while visible"). */
export const TITLE_HOLD_MS = 3000;
/** The overlap gate ignores slivers under this area (the same tolerance as the Playwright gate). */
export const OVERLAP_TOLERANCE_PX2 = 4;

export interface HudZoneBox {
  readonly zone: string;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface HudOverlap {
  readonly a: string;
  readonly b: string;
  readonly areaPx2: number;
}

/** Every pair of zone boxes that overlaps by more than the tolerance (an empty list is a pass). */
export function assertZeroHudZoneOverlap(boxes: readonly HudZoneBox[]): HudOverlap[] {
  const out: HudOverlap[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox <= 0 || oy <= 0) continue;
      const area = ox * oy;
      if (area > OVERLAP_TOLERANCE_PX2) out.push({ a: a.zone, b: b.zone, areaPx2: Math.round(area) });
    }
  }
  return out;
}

/** The zone boxes that reach into the reticle's clear zone, centred on (cx, cy). The reticle itself is not a zone box. */
export function boxesInReticleClearZone(boxes: readonly HudZoneBox[], cx: number, cy: number): HudZoneBox[] {
  const h = RETICLE_CLEAR_HALF_PX;
  return boxes.filter((b) => b.left < cx + h && b.right > cx - h && b.top < cy + h && b.bottom > cy - h);
}

/** A machine's floating label: shown within 14 m and 8 degrees of the crosshair, or always while Alt (the tactical view) is held. */
export const LABEL_MAX_DISTANCE_M = 14;
export const LABEL_MAX_AIM_DEG = 8;
export function shouldRenderMachineBillboard(aimAngleDeg: number, distanceM: number, isAltHeld: boolean): boolean {
  if (isAltHeld) return true;
  return distanceM <= LABEL_MAX_DISTANCE_M && Math.abs(aimAngleDeg) <= LABEL_MAX_AIM_DEG;
}

export interface HudVisibilityInput {
  readonly nowMs: number;
  readonly titleCardText: string | null;
  readonly titleCardExpiresAtMs: number;
  readonly isBuildDrawerOpen: boolean;
  readonly isPlacingStructure: boolean;
  readonly canPlaceCurrentGhost: boolean;
  readonly activeSubtitleText: string | null;
  readonly subtitleReadyAtMs: number;
  readonly coherence0to100: number;
  readonly isInsideSafeDomeOrLab: boolean;
  readonly isDrivingRover: boolean;
}

export interface HudVisibilityState {
  readonly showTitleCard: boolean;
  readonly showCannotPlaceWarning: boolean;
  readonly showSubtitleBanner: boolean;
  readonly showCoherenceGauge: boolean;
  readonly showRoverTelemetry: boolean;
}

/**
 * Which transient overlays show right now. The rules, in order of precedence:
 *  - a live title card holds CANNOT PLACE and the subtitle (the Moon arrival never has three text layers at once);
 *  - CANNOT PLACE shows only while a placement ghost is in view and cannot stand;
 *  - the subtitle yields to the open build drawer (their bands overlap), and waits for its own ready time;
 *  - the suit gauge hides at full coherence inside the lab or the gate's safe dome; driving shows the rover telemetry instead.
 */
export function computeHudVisibilityState(input: HudVisibilityInput): HudVisibilityState {
  const titleLive = input.titleCardText !== null && input.nowMs < input.titleCardExpiresAtMs;
  const showCannotPlaceWarning = input.isPlacingStructure && !input.canPlaceCurrentGhost && !titleLive;
  const showSubtitleBanner =
    input.activeSubtitleText !== null && !titleLive && !input.isBuildDrawerOpen && input.nowMs >= input.subtitleReadyAtMs;
  const showCoherenceGauge = !input.isDrivingRover && !(input.coherence0to100 >= 100 && input.isInsideSafeDomeOrLab);
  return {
    showTitleCard: titleLive,
    showCannotPlaceWarning,
    showSubtitleBanner,
    showCoherenceGauge,
    showRoverTelemetry: input.isDrivingRover,
  };
}

/** A stage title card: the toast a stage raises on arrival or a new stage (its text starts "Stage N", e.g. "Stage 0: Lunar Surface"). */
export function isTitleCardText(text: string): boolean {
  return /^stage \d/i.test(text.trim());
}

// ---- the transient queue: one banner at a time per slot; a title card holds the rest for its 3 s
//
// Time-driven and deterministic: a banner's start is the moment its slot freed up (or it was queued, whichever is later),
// and a secondary banner never starts before the latest title card ends. Calling advanceHudQueue at any later time
// gives the same schedule, so the queue can be recomputed from its own state.

export type HudSlot = 'title' | 'subtitle' | 'toast';

export interface HudBanner {
  readonly id: string;
  readonly slot: HudSlot;
  readonly text: string;
  readonly durationMs: number;
}

export interface HudLiveBanner {
  readonly banner: HudBanner;
  readonly startMs: number;
  readonly endMs: number;
}

export interface HudWaiting {
  readonly banner: HudBanner;
  readonly queuedAtMs: number;
}

export interface HudQueue {
  readonly live: Readonly<Partial<Record<HudSlot, HudLiveBanner>>>;
  readonly waiting: readonly HudWaiting[];
  /** When each slot last freed up (the end of its last banner). */
  readonly freeAtMs: Readonly<Partial<Record<HudSlot, number>>>;
  /** The end of the latest title card (0 before any). Secondary banners wait for it. */
  readonly titleEndMs: number;
}

export const EMPTY_HUD_QUEUE: HudQueue = { live: {}, waiting: [], freeAtMs: {}, titleEndMs: 0 };

const SLOT_PRIORITY: readonly HudSlot[] = ['title', 'subtitle', 'toast'];

/** Brings the schedule up to `nowMs`: frees expired slots and starts every banner whose start time has come. Pure. */
export function advanceHudQueue(q: HudQueue, nowMs: number): HudQueue {
  const live: Partial<Record<HudSlot, HudLiveBanner>> = {};
  const freeAtMs: Partial<Record<HudSlot, number>> = { ...q.freeAtMs };
  let waiting = [...q.waiting];
  for (const slot of SLOT_PRIORITY) {
    const cur = q.live[slot];
    if (cur && nowMs < cur.endMs) live[slot] = cur;
    else if (cur) freeAtMs[slot] = cur.endMs;
  }
  // 1. titles: one at a time, each as soon as the one before it has ended
  while (!live.title) {
    const idx = waiting.findIndex((w) => w.banner.slot === 'title');
    if (idx < 0) break;
    const w = waiting[idx]!;
    const start = Math.max(w.queuedAtMs, freeAtMs.title ?? 0);
    if (start > nowMs) break;
    waiting = [...waiting.slice(0, idx), ...waiting.slice(idx + 1)];
    const end = start + w.banner.durationMs;
    if (end > nowMs) live.title = { banner: w.banner, startMs: start, endMs: end };
    else freeAtMs.title = end;
  }
  // 2. the title barrier: the secondary banners wait until every title, live or still to come, has ended
  let barrier = live.title ? live.title.endMs : (freeAtMs.title ?? 0);
  for (const w of waiting) {
    if (w.banner.slot !== 'title') continue;
    barrier = Math.max(w.queuedAtMs, barrier) + w.banner.durationMs;
  }
  // 3. subtitles and toasts: one at a time per slot, never before the barrier
  for (const slot of ['subtitle', 'toast'] as const) {
    while (!live[slot]) {
      const idx = waiting.findIndex((w) => w.banner.slot === slot);
      if (idx < 0) break;
      const w = waiting[idx]!;
      const start = Math.max(w.queuedAtMs, freeAtMs[slot] ?? 0, barrier);
      if (start > nowMs) break;
      waiting = [...waiting.slice(0, idx), ...waiting.slice(idx + 1)];
      const end = start + w.banner.durationMs;
      if (end > nowMs) live[slot] = { banner: w.banner, startMs: start, endMs: end };
      else freeAtMs[slot] = end;
    }
  }
  return { live, waiting, freeAtMs, titleEndMs: barrier };
}

/** Queues a banner at `nowMs` (it waits for its slot and any title hold), then advances. */
export function enqueueHudBanner(q: HudQueue, banner: HudBanner, nowMs: number): HudQueue {
  return advanceHudQueue({ ...q, waiting: [...q.waiting, { banner, queuedAtMs: nowMs }] }, nowMs);
}

/** The banners on screen at `nowMs`, in SLOT_PRIORITY order. */
export function visibleHudBanners(q: HudQueue, nowMs: number): HudLiveBanner[] {
  const a = advanceHudQueue(q, nowMs);
  const out: HudLiveBanner[] = [];
  for (const slot of SLOT_PRIORITY) {
    const b = a.live[slot];
    if (b && nowMs >= b.startMs && nowMs < b.endMs) out.push(b);
  }
  return out;
}

/** A title card is holding the secondary banners at `nowMs`. */
export function titleHoldsBanners(q: HudQueue, nowMs: number): boolean {
  return nowMs < advanceHudQueue(q, nowMs).titleEndMs;
}

// ---- the stage-reactive fidelity skin (plan 28)

export type FidelitySkin = '0a' | '0b' | '1' | '2' | '3' | '4-6';
export const FIDELITY_SKINS: readonly FidelitySkin[] = ['0a', '0b', '1', '2', '3', '4-6'];
/** A new skin must hold this long before the HUD flips to it (plan 28's 0.5 s debounce). */
export const FIDELITY_HOLD_MS = 500;
/** The glitch that marks the flip (plan 28: 120 ms). */
export const FIDELITY_SHIFT_MS = 120;

/**
 * The skin the player's ground calls for. In the shielded lab the skin is 3 while the power is off and 4-6 once the
 * breaker is thrown. On the planet it follows the plot's stage: stage 0 is 0a on arrival and 0b once a machine stands.
 */
export function fidelitySkinFor(input: {
  readonly stage: number;
  readonly machinesOnPlot: number;
  readonly inShieldedLab: boolean;
  readonly labPowerOn: boolean;
}): FidelitySkin {
  if (input.inShieldedLab) return input.labPowerOn ? '4-6' : '3';
  const s = Math.max(0, Math.min(6, Math.floor(input.stage)));
  if (s === 0) return input.machinesOnPlot > 0 ? '0b' : '0a';
  if (s === 1) return '1';
  if (s === 2) return '2';
  if (s === 3) return '3';
  return '4-6';
}

export interface FidelityTrack {
  readonly skin: FidelitySkin;
  readonly candidate: FidelitySkin;
  readonly candidateSinceMs: number;
  /** The skin changed on this step (the caller plays the 120 ms shift). */
  readonly flipped: boolean;
}

/** Starts a track on `skin` at `nowMs`. */
export function startFidelityTrack(skin: FidelitySkin, nowMs: number): FidelityTrack {
  return { skin, candidate: skin, candidateSinceMs: nowMs, flipped: false };
}

/** One step: a candidate skin flips the HUD only after it has held for FIDELITY_HOLD_MS, so a border never strobes. */
export function stepFidelityTrack(t: FidelityTrack, candidate: FidelitySkin, nowMs: number): FidelityTrack {
  if (candidate === t.skin) return { skin: t.skin, candidate, candidateSinceMs: nowMs, flipped: false };
  const since = candidate === t.candidate ? t.candidateSinceMs : nowMs;
  if (nowMs - since >= FIDELITY_HOLD_MS) return { skin: candidate, candidate, candidateSinceMs: nowMs, flipped: true };
  return { skin: t.skin, candidate, candidateSinceMs: since, flipped: false };
}
