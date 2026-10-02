import type { ReactElement } from 'react';
import { rootClass } from './styles';

export function PauseMenu(props: { onResume: () => void; onRestart: () => void; onSettings: () => void; onQuit: () => void; reducedMotion?: boolean }): ReactElement {
  return (
    <div className={rootClass('dim', props.reducedMotion)} role="dialog" aria-modal="true" aria-label="Paused" data-screen="paused">
      <h2>Paused</h2>
      <div className="hms-col">
        <button type="button" className="hms-btn go" data-action="resume" autoFocus onClick={props.onResume}>Resume</button>
        <button type="button" className="hms-btn" data-action="restart" onClick={props.onRestart}>Restart race</button>
        <button type="button" className="hms-btn" data-action="settings" onClick={props.onSettings}>Settings</button>
        <button type="button" className="hms-btn quiet" data-action="quit" onClick={props.onQuit}>Quit to title</button>
      </div>
    </div>
  );
}
