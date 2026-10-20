// ============================================================================
// File: apps/web/src/shell/menu-hero-blade.tsx
// TICKET-24 (POL-01, POL-64, POL-71, POL-85):
// - Renders the frosted glass blade (`menu-glass-blade`) behind the 6-button
//   Main Menu on the left of the PBR Lab backdrop.
// - Drives the Stage-0/1 desolate wasteland out-of-sync glitch in the Lab
//   observation window while framing the Stage-4 lush terraformed hero vista
//   inside the right-hand Quantum Gate archway (OWNER_ASKS 2026-10-06 & 10-07).
// - Exports `FIDELITY_LOADER_LABELS` (POL-71) and `toggleAndPersistPlaySync` (POL-85).
// ============================================================================

import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import {
  computeMenuHeroVistaState,
  FIDELITY_LOADER_LABELS,
} from '@hm/hudmath/ega-palette-and-degauss';
import { writePlaySyncMode, type PlaySyncMode } from '../crafter/shared-planet';

export { FIDELITY_LOADER_LABELS };

/**
 * POL-85: Writes the remembered Synced/Desynced mode to `hm.setmix.play.sync`
 * whenever the player toggles Sync/Desync from either the Main Menu or the Play HUD.
 */
export function toggleAndPersistPlaySync(current: PlaySyncMode): PlaySyncMode {
  const next: PlaySyncMode = current === 'synced' ? 'desynced' : 'synced';
  return writePlaySyncMode(next);
}

export function MenuHeroGlassBlade(props: {
  readonly timeSec?: number;
  readonly children: ReactNode;
}): ReactElement {
  const [clockSec, setClockSec] = useState(props.timeSec ?? 0);

  useEffect(() => {
    if (props.timeSec !== undefined) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number): void => {
      setClockSec((now - t0) / 1000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [props.timeSec]);

  const vista = computeMenuHeroVistaState(props.timeSec ?? clockSec);

  return (
    <div
      className="menu-hero-backdrop"
      data-window-stage={vista.windowWastelandStage}
      data-window-glitch={vista.windowGlitchIntensity}
      data-portal-hero-stage={vista.portalHeroStage}
    >
      <aside
        className="menu-glass-blade"
        style={{
          backdropFilter: `blur(${vista.glassBladeBlurPx}px)`,
          WebkitBackdropFilter: `blur(${vista.glassBladeBlurPx}px)`,
        }}
      >
        {props.children}
      </aside>
    </div>
  );
}
