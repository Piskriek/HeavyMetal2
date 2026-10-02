import type { ReactElement } from 'react';
import { rootClass } from './styles';

/** The countdown over the start grid. Clicks pass through it. */
export function IntroOverlay(props: { countdown: number; trackName?: string; lap?: number; laps?: number; reducedMotion?: boolean }): ReactElement {
  const go = props.countdown <= 0;
  return (
    <div className={rootClass('dim', props.reducedMotion)} data-screen="intro" data-count={String(Math.max(0, Math.round(props.countdown)))} style={{ background: 'transparent', backdropFilter: 'none', pointerEvents: 'none' }}>
      <div className={`hms-count${go ? ' go' : ''}`} key={props.countdown}>{go ? 'GO!' : Math.round(props.countdown)}</div>
      {props.trackName ? <p className="hms-sub" style={{ textShadow: '0 2px 6px #000' }}>{props.trackName}</p> : null}
      {props.laps ? <p style={{ fontWeight: 800, textShadow: '0 2px 6px #000' }}>Lap {props.lap ?? 1} of {props.laps}</p> : null}
    </div>
  );
}
