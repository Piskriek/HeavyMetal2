// ============================================================================
// File: apps/web/src/base/ui/hud-bits.tsx
// TICKET-04 small HUD pieces shared by the windows, the build menu and the play screen:
//  - ThumbImg: a 3D thumbnail (or swatch) of an item, machine or piece kind, through useItemThumb;
//  - thumbFor: the same picture as a promise, for radial slices that are filled when the wheel opens;
//  - CloseHint: the Esc (or Esc / Tab) keycap that sits on every modal's close button;
//  - HoldRing: the progress ring at the crosshair while Z is held to remove a piece.
// ============================================================================

import React from 'react';
import { thumbOf } from '../../studio/studio-thumbs';
import { thumbAssetFor, type ThumbRef } from './thumb-map';
import { swatchFor, useItemThumb } from './use-item-thumb';
import './hud-bits.css';

/** The picture for a ref: its packed 3D thumbnail when it has a mesh, else its swatch. Null when neither exists. */
export function thumbFor(ref: ThumbRef): Promise<string | null> {
  const asset = thumbAssetFor(ref);
  if (asset) return thumbOf(asset).then((url) => url ?? swatchFor(ref));
  return Promise.resolve(swatchFor(ref));
}

export const ThumbImg: React.FC<{ readonly thumb: ThumbRef; readonly size: number; readonly className?: string }> = ({ thumb, size, className }) => {
  const url = useItemThumb(thumb);
  if (!url) return null;
  return (
    <img
      src={url}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={`hm-thumb-img${className ? ` ${className}` : ''}`}
    />
  );
};

export const CloseHint: React.FC<{ readonly keys?: readonly string[] }> = ({ keys = ['Esc'] }) => (
  <span className="hm-close-hint" aria-hidden="true">
    {keys.map((k, i) => (
      <React.Fragment key={k}>
        {i > 0 ? <span className="hm-close-hint-sep">/</span> : null}
        <kbd>{k}</kbd>
      </React.Fragment>
    ))}
    <span className="hm-close-hint-word">Close</span>
  </span>
);

/** The hold-to-remove ring: it fills over `ms` and is unmounted when Z is let go. Sits on the crosshair; not a HUD zone. */
export const HoldRing: React.FC<{ readonly ms: number }> = ({ ms }) => (
  <div className="hm-hold-ring" aria-hidden="true" data-testid="hold-ring">
    <svg viewBox="0 0 64 64">
      <circle className="hm-hold-ring-track" cx="32" cy="32" r="26" />
      <circle className="hm-hold-ring-fill" cx="32" cy="32" r="26" style={{ animationDuration: `${ms}ms` }} />
    </svg>
  </div>
);
