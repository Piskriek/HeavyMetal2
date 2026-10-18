// The nine-zone HUD's React layer (TASK-25). The zone containers only anchor and stack their overlays; each overlay is a
// leaf that carries data-hud-zone, so the overlap gate compares the things a player actually sees. The skin is set on the
// play root as data-fidelity, and every zone takes its look from the CSS variables that skin defines.
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import './hud-zones.css';
import './pixel-font.css';
import type { HudZone as Zone } from './hud-zones-logic';

/** A zone's anchor. It has no data attribute of its own: its overlays do. */
export function HudZone(props: { readonly zone: Zone; readonly className?: string; readonly children?: ReactNode }): ReactElement {
  return <div className={`hud-zone hud-zone--${props.zone}${props.className ? ` ${props.className}` : ''}`}>{props.children}</div>;
}

/** The compass ribbon: the bearing to the Gate, relative to where the player faces. Ticks scroll under a fixed marker. */
export function CompassRibbon(props: {
  /** Degrees from the player's facing to the Gate: 0 is dead ahead, positive is to the right. */
  readonly relativeDeg: number | null;
  readonly distanceM: number | null;
  /** Sync is low outside a dome (TASK-26): the gate marker turns amber, the return arrow. */
  readonly warn?: boolean;
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

/** The sync state word beside the compass: SYNC: STABLE, or DRAINING while the suit loses coherence. */
export function SyncWord(props: { readonly draining: boolean; readonly hidden?: boolean }): ReactElement | null {
  if (props.hidden) return null;
  return (
    <span className={`hud-sync-word${props.draining ? ' draining' : ''}`} data-hud-zone="top-centre">
      SYNC: {props.draining ? 'DRAINING' : 'STABLE'}
    </span>
  );
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
          <li key={f.key} style={{ '--c': f.colour } as CSSProperties} title={`${f.name} ${Math.floor(f.value)}`}>
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
