// ============================================================================
// File: apps/web/src/base/ui/radial-menu.tsx
// TICKET-04 (OPUS_NOTE_11 Item C):
// Reusable context-driven radial wheel on X (2..12 slices) for:
//  - Build mode: held blueprint's structure kinds with 3D thumbnails
//  - Beam Apply mode: texture cartridges as swatches
//  - Beam Sculpt mode: carve, raise, smooth
// Mouse direction highlights; click or releasing X picks; Esc cancels.
// Locked slices display their lock reason and cannot be picked.
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import './radial-menu.css';

export interface RadialSlice {
  readonly id: string;
  readonly label: string;
  readonly thumb?: string | null;
  readonly locked?: string | null;
}

export interface RadialEmptyState {
  readonly message: string;
  readonly icon?: string;
}

export interface RadialMenuProps {
  readonly slices: readonly RadialSlice[];
  readonly hint: string;
  readonly emptyState?: RadialEmptyState | string | null;
  readonly onPick: (id: string) => void;
  readonly onClose: () => void;
}

const WHEEL_RADIUS = 138;
const DEADZONE_PX = 26;

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number): { x: number; y: number } {
  // 0 rad = top (-Y), clockwise
  return {
    x: cx + r * Math.sin(angleRad),
    y: cy - r * Math.cos(angleRad),
  };
}

function buildWedgePath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startRad: number,
  endRad: number
): string {
  const p1 = polarToCartesian(cx, cy, rOuter, startRad);
  const p2 = polarToCartesian(cx, cy, rOuter, endRad);
  const p3 = polarToCartesian(cx, cy, rInner, endRad);
  const p4 = polarToCartesian(cx, cy, rInner, startRad);
  const largeArc = endRad - startRad > Math.PI ? 1 : 0;

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export const RadialMenu: React.FC<RadialMenuProps> = ({
  slices,
  hint,
  emptyState,
  onPick,
  onClose,
}) => {
  const clampedSlices = slices.slice(0, 12);
  const count = Math.max(2, clampedSlices.length);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef<number | null>(null);
  activeIndexRef.current = activeIndex;

  const commitSlice = useCallback(
    (idx: number | null) => {
      if (idx === null) {
        onClose();
        return;
      }
      const slice = clampedSlices[idx];
      if (!slice || slice.locked) {
        return;
      }
      onPick(slice.id);
    },
    [clampedSlices, onPick, onClose]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyX' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        e.stopPropagation();
        const idx = activeIndexRef.current;
        if (idx !== null) {
          const s = clampedSlices[idx];
          if (s && !s.locked) {
            onPick(s.id);
            return;
          }
        }
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [clampedSlices, onPick, onClose]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wheelRef.current;
    if (!el || clampedSlices.length === 0) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist < DEADZONE_PX) {
      setActiveIndex(null);
      return;
    }

    // Angle in [0, 2*PI) where 0 is top (-Y) and increases clockwise (+X is PI/2)
    const stepRad = (Math.PI * 2) / count;
    let angle = Math.atan2(dx, -dy) + stepRad / 2;
    if (angle < 0) angle += Math.PI * 2;
    angle = angle % (Math.PI * 2);

    const idx = Math.floor(angle / stepRad);
    setActiveIndex(idx < clampedSlices.length ? idx : null);
  };

  const activeSlice = activeIndex !== null ? clampedSlices[activeIndex] ?? null : null;
  const stepRad = (Math.PI * 2) / count;
  const gapRad = count > 8 ? 0.018 : 0.028;

  return (
    <div
      className="hm-radial-overlay"
      onMouseMove={handleMouseMove}
      onClick={() => commitSlice(activeIndex)}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={hint}
      data-testid="radial-menu"
    >
      <div
        ref={wheelRef}
        className="hm-radial-wheel"
        onClick={(e) => e.stopPropagation()}
      >
        {clampedSlices.length === 0 ? (
          <div className="hm-radial-empty-card" data-testid="radial-empty-state">
            <div className="hm-radial-empty-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="3" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="16" y2="10" />
                <circle cx="12" cy="15" r="2" />
              </svg>
            </div>
            <strong className="hm-radial-empty-title">{hint}</strong>
            <p className="hm-radial-empty-msg" data-testid="radial-empty-msg">
              {typeof emptyState === 'string'
                ? emptyState
                : emptyState?.message ?? 'No written cartridges: write one at the preset bench'}
            </p>
            <span className="hm-radial-hub-keys">
              <kbd>Esc</kbd> or release <kbd>X</kbd> to close
            </span>
          </div>
        ) : (
          <>
            {/* SVG Wedge Sectors */}
            <svg
              className="hm-radial-svg"
              viewBox="0 0 380 380"
              aria-hidden="true"
            >
              <circle
                cx="190"
                cy="190"
                r="176"
                className="hm-radial-outer-ring"
              />
              {clampedSlices.map((slice, idx) => {
                const centerRad = idx * stepRad;
                const startRad = centerRad - stepRad / 2 + gapRad;
                const endRad = centerRad + stepRad / 2 - gapRad;
                const isSelected = activeIndex === idx;
                const isLocked = Boolean(slice.locked);
                const d = buildWedgePath(190, 190, 62, 170, startRad, endRad);

                return (
                  <path
                    key={slice.id}
                    d={d}
                    className={`hm-radial-wedge${isSelected ? ' is-active' : ''}${isLocked ? ' is-locked' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      if (!isLocked) onPick(slice.id);
                    }}
                  />
                );
              })}
            </svg>

            {/* Slice Content Nodes (Thumbnail + UI Label) */}
            {clampedSlices.map((slice, idx) => {
              const centerRad = idx * stepRad;
              const pos = polarToCartesian(190, 190, WHEEL_RADIUS - 22, centerRad);
              const isSelected = activeIndex === idx;
              const isLocked = Boolean(slice.locked);

              return (
                <button
                  key={slice.id}
                  type="button"
                  className={`hm-radial-slice${isSelected ? ' is-active' : ''}${isLocked ? ' is-locked' : ''}`}
                  style={{
                    left: `${(pos.x / 380) * 100}%`,
                    top: `${(pos.y / 380) * 100}%`,
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    if (!isLocked) onPick(slice.id);
                  }}
                  aria-disabled={isLocked}
                  data-testid={`radial-slice-${slice.id}`}
                >
                  {slice.thumb ? (
                    <img
                      src={slice.thumb}
                      alt=""
                      className="hm-radial-slice-thumb"
                      draggable={false}
                    />
                  ) : (
                    <span className="hm-radial-slice-dot" aria-hidden="true" />
                  )}
                  <span className="hm-radial-slice-label">{slice.label}</span>
                  {isLocked && (
                    <span className="hm-radial-slice-lock-tag">LOCKED</span>
                  )}
                </button>
              );
            })}

            {/* Centre Telemetry Hub */}
            <div className="hm-radial-hub" data-testid="radial-hub">
              <span className="hm-radial-hub-hint">{hint}</span>
              <strong className="hm-radial-hub-title">
                {activeSlice ? activeSlice.label : 'Move mouse to select'}
              </strong>
              {activeSlice?.locked ? (
                <span className="hm-radial-hub-locked" data-testid="radial-locked-reason">
                  {activeSlice.locked}
                </span>
              ) : (
                <span className="hm-radial-hub-keys">
                  <kbd>Click</kbd> or release <kbd>X</kbd> · <kbd>Esc</kbd> Cancel
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RadialMenu;
