import type { ReactElement } from 'react';
import { GoblinFace } from './GoblinFace';
import { rootClass } from './styles';

/** The first screen: logo, a goblin in a glass ball, and the ways to play. */
export function TitleScreen(props: { title?: string; subtitle?: string; quickLabel?: string; seriesLabel?: string; onPlay: (mode: 'quick' | 'championship') => void; onSettings: () => void; onEditor?: () => void; reducedMotion?: boolean; version?: string }): ReactElement {
  return (
    <div className={rootClass('bg', props.reducedMotion)} data-screen="title">
      <div className="hms-col">
        <div className="hms-ball" aria-hidden="true" style={{ position: 'relative', width: 124, height: 124, borderRadius: '50%', background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.75), rgba(190,232,255,0.28) 38%, rgba(120,190,230,0.22) 70%, rgba(255,255,255,0.4) 100%)', border: '2px solid rgba(255,255,255,0.45)', display: 'grid', placeItems: 'center', boxShadow: '0 18px 30px rgba(0,0,0,0.45), inset 0 -10px 24px rgba(80,160,210,0.35)' }}>
          <GoblinFace color="#6fc24a" accent="#ffd24a" size={76} />
        </div>
        <h1 className="hms-logo">{(props.title ?? 'GOBLIN BALL RACERS').split('\n').flatMap((l, i) => (i ? [<br key={`b${i}`} />, l] : [l]))}</h1>
        <p className="hms-sub">{props.subtitle ?? 'Basalt Isle'}</p>
      </div>
      <div className="hms-col" style={{ marginTop: 6 }}>
        <button type="button" className="hms-btn go" data-action="quick" onClick={() => props.onPlay('quick')}>{props.quickLabel ?? 'Quick Race'}</button>
        <button type="button" className="hms-btn" data-action="championship" onClick={() => props.onPlay('championship')}>{props.seriesLabel ?? 'Championship'}</button>
        <div className="hms-row">
          <button type="button" className="hms-btn quiet" data-action="settings" onClick={props.onSettings}>Settings</button>
          {props.onEditor ? <button type="button" className="hms-btn quiet" data-action="editor" onClick={props.onEditor}>My Island</button> : null}
        </div>
      </div>
      {props.version ? <p className="hms-hint" style={{ position: 'absolute', bottom: 8 }}>v{props.version}</p> : null}
    </div>
  );
}
