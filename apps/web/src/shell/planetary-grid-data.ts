// ============================================================================
// File: apps/web/src/shell/planetary-grid-data.ts
// Pure data types and validation helpers for the Planetary Grid screen (POL-87).
// Does NOT import CSS so Node unit tests can import this safely.
// ============================================================================

import { decodePlot } from '../play/plot-code';
import type { ReconnectState } from '../net/outpost-client';

export const CONNECTION_TEXT: Readonly<Record<ReconnectState, string>> = {
  connecting: 'Connecting...',
  connected: 'Connected',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
  error: 'Connection error',
};

export interface PlotCodeCheck {
  readonly ok: boolean;
  readonly why?: string;
  readonly owner?: string;
  readonly stage?: number;
  readonly machines?: number;
}

/**
 * Pure validator wrapping `decodePlot(code)`.
 * Returns `{ ok: true, owner, stage, machines }` for a valid base64url plot snapshot,
 * or `{ ok: false, why }` when empty or corrupt.
 */
export function checkPlotCode(code: string): PlotCodeCheck {
  if (typeof code !== 'string') {
    return { ok: false, why: 'Paste a plot code to visit.' };
  }
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return { ok: false, why: 'Paste a plot code to visit.' };
  }
  const snap = decodePlot(trimmed);
  if (!snap) {
    return { ok: false, why: 'Invalid or corrupted plot code.' };
  }
  return {
    ok: true,
    owner: snap.owner,
    stage: snap.stage,
    machines: snap.machines.length,
  };
}
