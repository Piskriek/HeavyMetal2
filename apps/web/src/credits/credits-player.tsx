// ============================================================================
// File: apps/web/src/credits/credits-player.tsx
// TICKET-14: the credits video's overlay, as play.tsx mounts it. It reads the director's video clock once a frame (only the
// HUD re-renders, never the play screen), and hands Esc and the replay button back to the play screen.
// ============================================================================

import { useEffect, useState } from 'react';
import type { CreditsDirector } from './index';
import { CreditsHud } from './credits-hud';

export interface CreditsPlayerProps {
  readonly director: CreditsDirector;
  readonly onExit: () => void;
  readonly onReplay: () => void;
}

/** A video clock change smaller than this (seconds) does not re-render the HUD: about a 30th of a second. */
const CLOCK_STEP_SEC = 1 / 30;

export function CreditsPlayer({ director, onExit, onReplay }: CreditsPlayerProps) {
  const [elapsed, setElapsed] = useState(() => director.elapsedSec());

  useEffect(() => {
    let raf = 0;
    let shown = director.elapsedSec();
    const tick = (): void => {
      const now = director.elapsedSec();
      if (Math.abs(now - shown) >= CLOCK_STEP_SEC || now < shown) {
        shown = now;
        setElapsed(now);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [director]);

  return <CreditsHud elapsedSec={elapsed} onExitCredits={onExit} onReplayCredits={onReplay} />;
}
