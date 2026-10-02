import type { ReactElement } from 'react';
import { rootClass } from './styles';
import type { Settings } from './types';

function Segment<K extends 'quality' | 'touchControls'>(props: { field: K; label: string; value: Settings[K]; options: readonly Settings[K][]; names?: Partial<Record<Settings[K] & string, string>>; onChange: (patch: Partial<Settings>) => void }): ReactElement {
  return (
    <div className="hms-toggle" data-field={props.field}>
      <span>{props.label}</span>
      <span className="hms-seg" role="group" aria-label={props.label}>
        {props.options.map((o) => <button key={String(o)} type="button" data-value={String(o)} aria-pressed={props.value === o} onClick={() => props.onChange({ [props.field]: o } as Partial<Settings>)} style={{ textTransform: 'capitalize' }}>{props.names?.[o as Settings[K] & string] ?? String(o)}</button>)}
      </span>
    </div>
  );
}

const Volume = (p: { field: 'master' | 'sfx' | 'music'; label: string; value: number; onChange: (patch: Partial<Settings>) => void }): ReactElement => (
  <label className="hms-field"><span>{p.label}</span><input type="range" data-field={p.field} min={0} max={100} step={1} value={Math.round(p.value * 100)} onChange={(e) => p.onChange({ [p.field]: Number(e.target.value) / 100 } as Partial<Settings>)} /><span style={{ textAlign: 'right' }}>{Math.round(p.value * 100)}%</span></label>
);

const Check = (p: { field: 'reducedMotion' | 'invertSteer' | 'showMinimap'; label: string; value: boolean; onChange: (patch: Partial<Settings>) => void }): ReactElement => (
  <label className="hms-toggle"><span>{p.label}</span><input type="checkbox" data-field={p.field} checked={p.value} onChange={(e) => p.onChange({ [p.field]: e.target.checked } as Partial<Settings>)} /></label>
);

export function SettingsScreen(props: { settings: Settings; onChange: (patch: Partial<Settings>) => void; onClose: () => void; onReset?: () => void; tier?: 'play' | 'build' | 'pro'; reducedMotion?: boolean }): ReactElement {
  const s = props.settings, set = props.onChange;
  return (
    <div className={rootClass('bg', props.reducedMotion)} data-screen="settings">
      <h2>Settings</h2>
      <div className="hms-panel">
        <Volume field="master" label="Master volume" value={s.master} onChange={set} />
        <Volume field="sfx" label="Effects" value={s.sfx} onChange={set} />
        <Volume field="music" label="Music" value={s.music} onChange={set} />
        <Segment field="quality" label="Graphics" value={s.quality} options={['auto', 'low', 'medium', 'high', 'ultra']} onChange={set} />
        <Segment field="touchControls" label="Touch controls" value={s.touchControls} options={['auto', 'on', 'off']} onChange={set} />
        <Check field="showMinimap" label="Show the minimap" value={s.showMinimap} onChange={set} />
        <Check field="invertSteer" label="Invert steering" value={s.invertSteer} onChange={set} />
        <Check field="reducedMotion" label="Reduce motion" value={s.reducedMotion} onChange={set} />
        {props.tier === 'pro' ? <pre data-field="json" className="hms-hint" style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{JSON.stringify(s, null, 2)}</pre> : null}
      </div>
      <div className="hms-row">
        {props.onReset ? <button type="button" className="hms-btn quiet" data-action="reset" onClick={props.onReset}>Reset to defaults</button> : null}
        <button type="button" className="hms-btn go" data-action="close" onClick={props.onClose}>Done</button>
      </div>
    </div>
  );
}
