// The nine-zone HUD's React layer (TASK-25 + TICKET-18 POL-35, POL-44, POL-45, POL-46).
// The zone containers only anchor and stack their overlays; each overlay is a
// leaf that carries data-hud-zone, so the overlap gate compares the things a player actually sees.
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import './hud-zones.css';
import './pixel-font.css';
// The harness blade's styles load with the zones so its own module stays importable from node tests (plan 47).
import './harness-telemetry-hud.css';
import type { HudZone as Zone } from './hud-zones-logic';
import {
  BUILD_DRAWER_BOTTOM_PX,
  SIDE_STACK_CLEARANCE_PX,
  type CompassLeakBearing,
  type DrivingDriftBadgeState,
} from '@hm/hudmath/toast-queue-and-compass';

/** A zone's anchor. It has no data attribute of its own: its overlays do. */
export function HudZone(props: { readonly zone: Zone; readonly className?: string; readonly children?: ReactNode }): ReactElement {
  return <div className={`hud-zone hud-zone--${props.zone}${props.className ? ` ${props.className}` : ''}`}>{props.children}</div>;
}

/**
 * The compass ribbon: the bearing to the Gate AND active unsealed S-Space leaks (POL-44),
 * relative to where the player faces. Ticks scroll under a fixed marker.
 */
export function CompassRibbon(props: {
  /** Degrees from the player's facing to the Gate: 0 is dead ahead, positive is to the right. */
  readonly relativeDeg: number | null;
  readonly distanceM: number | null;
  /** Sync is low outside a dome (TASK-26): the gate marker turns amber, the return arrow. */
  readonly warn?: boolean;
  /** POL-44: Active unsealed leak bearings rendered as violet rift ticks on the compass strip. */
  readonly leaks?: readonly CompassLeakBearing[];
}): ReactElement {
  const rel = props.relativeDeg;
  const shown = rel === null ? null : Math.max(-90, Math.min(90, rel));
  const off = rel !== null && Math.abs(rel) > 90;
  return (
    <div className="hud-compass" data-hud-zone="top-centre" aria-label="Bearing to the gate" role="img">
      <div className="hud-compass-strip" aria-hidden="true">
        {[-90, -45, 0, 45, 90].map((d) => (
          <span key={d} className={`hud-compass-tick${d === 0 ? ' mid' : ''}`} style={{ left: `${50 + (d / 90) * 50}%` }} />
        ))}
        {props.leaks?.map((lk) => (
          <i
            key={`leak-${lk.site}`}
            className={`hud-compass-leak${lk.edge ? ' edge' : ''}`}
            title={`Rift Leak #${lk.site} (${Math.round(lk.distanceM)} m)`}
            style={{ left: `${50 + (lk.clampedDeg / 90) * 50}%` }}
          />
        ))}
        {shown !== null ? (
          <i className={`hud-compass-gate${off ? ' edge' : ''}${props.warn ? ' warn' : ''}`} style={{ left: `${50 + (shown / 90) * 50}%` }} />
        ) : null}
      </div>
      <span className="hud-compass-label">
        {props.distanceM === null ? 'GATE --' : `GATE ${props.distanceM < 1000 ? `${Math.round(props.distanceM)} m` : `${(props.distanceM / 1000).toFixed(1)} km`}`}
      </span>
    </div>
  );
}

/**
 * The sync state word beside the compass: SYNC: STABLE, or DRAINING while the suit loses coherence.
 * POL-44: Automatically hides when `insideGateDome` is true (within the 25 m Moon Twin Gate dome) or `hidden` is true.
 */
export function SyncWord(props: {
  readonly draining: boolean;
  readonly hidden?: boolean;
  readonly insideGateDome?: boolean;
}): ReactElement | null {
  if (props.hidden || props.insideGateDome) return null;
  return (
    <span className={`hud-sync-word${props.draining ? ' draining' : ''}`} data-hud-zone="top-centre">
      SYNC: {props.draining ? 'DRAINING' : 'STABLE'}
    </span>
  );
}

/**
 * POL-44: Driving speed + drift badge shown while piloting a rover (`DRIFT 24°` when slip angle >= 12°).
 */
export function DrivingHudBadge(props: { readonly telemetry: DrivingDriftBadgeState | null }): ReactElement | null {
  if (!props.telemetry) return null;
  const { speedKmh, drifting, label } = props.telemetry;
  return (
    <div className={`hud-driving-badge${drifting ? ' is-drifting' : ''}`} data-hud-zone="bottom-right" role="status">
      <span className="hud-driving-speed">{speedKmh} km/h</span>
      {drifting && label ? <b className="hud-driving-drift">{label}</b> : null}
    </div>
  );
}

/**
 * POL-45 & POL-46: Inline style helper for the Build Drawer so it clears both 200 px side stacks
 * below 1280 px (`maxWidth: calc(100vw - 496px)`, 528 px wide at 1024 px with horizontal card scrolling)
 * and sits at `bottom: 104px` to clear the 76 px hotbar at bottom 24 px.
 */
export function resolveBuildDrawerStyle(extra?: CSSProperties): CSSProperties {
  return {
    bottom: `${BUILD_DRAWER_BOTTOM_PX}px`,
    maxWidth: `calc(100vw - ${SIDE_STACK_CLEARANCE_PX}px)`,
    overflowX: 'auto',
    ...extra,
  };
}

/** The four floats as one compact pill, in the metric colours, with the stage badge S0 to S6. Each bar has its own
 *  pattern too (solid, hatched, stepped, dotted), so the four still read apart in the low-bit skins. */
export function FloatsPill(props: {
  readonly stage: number;
  readonly floats: readonly { readonly key: string; readonly name: string; readonly colour: string; readonly value: number }[];
}): ReactElement {
  const patterns = ['solid', 'hatch', 'steps', 'dots'] as const;
  return (
    <div className="hud-floats" data-hud-zone="top-right" aria-label={`Fidelity floats, stage ${props.stage}`}>
      <span className="hud-stage-badge" aria-label={`Stage ${props.stage}`}>S{props.stage}</span>
      <ul className="hud-floats-bars">
        {props.floats.map((f, i) => (
          <li key={f.key} data-metric={f.key} style={{ '--c': f.colour } as CSSProperties} title={`${f.name} ${Math.floor(f.value)}`}>
            <span className="hud-float-name">{f.name}</span>
            <i className={`hud-float-bar pat-${patterns[i % patterns.length]}`}>
              <s style={{ width: `${Math.max(0, Math.min(100, f.value))}%` }} />
            </i>
            <b>{Math.floor(f.value)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A machine's floating label. It is drawn only when the aim or Alt rule allows it (shouldRenderMachineBillboard). */
export function MachineLabel(props: { readonly x: number; readonly y: number; readonly name: string; readonly state: string; readonly tone: 'ok' | 'warn' | 'bad' }): ReactElement {
  return (
    <div className={`hud-machine-label tone-${props.tone}`} data-hud-zone="centre" style={{ left: props.x, top: props.y }}>
      <b>{props.name}</b>
      <span>{props.state}</span>
    </div>
  );
}
