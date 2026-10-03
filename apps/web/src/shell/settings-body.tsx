import type { ReactElement, ReactNode } from 'react';
import { FPS_TARGETS, parseQuality, tidyGpuName, type Quality } from '@hm/game';
import { ControlsList, ControlsSettings } from './controls-list';
import { GraphicsTuning } from './graphics-tuning';
import { gpuInUse, tierInUse, type GpuChoice, type Profile } from './profile';

type Choice = 'auto' | Quality;
/** The graphics presets, lightest first, as one-click buttons (owner: "scale down to the calculator version with the click of a preset button", since renamed Potato). */
const PRESETS: readonly { readonly id: Choice; readonly name: string; readonly says: string }[] = [
  { id: 'potato', name: 'Potato', says: 'The lightest the game can be: a small picture, flat ground, no clouds or shadows, and plants only nearby. For very old or very busy machines.' },
  { id: 'low', name: 'Low', says: 'Light: a 720p picture, no shadows or picture effects, simple lighting. Smooth on older laptops.' },
  { id: 'medium', name: 'Medium', says: 'Sun shadows, glow and sky reflections.' },
  { id: 'high', name: 'High', says: 'Sharper shadows, contact shadows and smooth edges.' },
  { id: 'ultra', name: 'Ultra', says: 'Everything, drawn at more pixels than the screen has. For strong graphics cards.' },
  { id: 'auto', name: 'Auto', says: 'Starts at what your graphics card can probably do, then raises or lowers the graphics to keep up the frame rate you aim for.' },
];

/**
 * Settings: the settings presets. One body for the main menu's Settings and the island's Settings window (Esc, Settings): graphics presets
 * first (one click from Potato to Ultra, or Auto with a frame-rate target), then fine-tuning, the graphics card, the profile and controls.
 */
export function SettingsBody(props: {
  readonly profile: Profile; readonly update: (fn: (p: Profile) => Profile) => void;
  readonly onReplayTour: () => void; readonly onReset: () => void;
  /** Shown first (the island adds a jump to the lighting presets). */
  readonly top?: ReactNode;
}): ReactElement {
  const { profile, update } = props;
  const picked = PRESETS.find((p) => p.id === profile.quality) ?? PRESETS[PRESETS.length - 1]!;
  const gpu = gpuInUse();
  return (
    <div className="settings-body">
      {props.top}
      <div className="graphics-presets" role="group" aria-label="Graphics">
        <span>Graphics</span>
        <span className="seg">{PRESETS.map((p) => <button key={p.id} className={profile.quality === p.id ? 'on' : ''} aria-pressed={profile.quality === p.id} onClick={() => update((x) => ({ ...x, quality: p.id }))}>{p.name}</button>)}</span>
      </div>
      <p className="hint">{picked.says}</p>
      {profile.quality === 'auto' ? (
        <div className="row fps-target" role="group" aria-label="Aim for">
          <span>Aim for</span>
          <span className="seg">{FPS_TARGETS.map((f) => <button key={f} className={profile.fpsTarget === f ? 'on' : ''} aria-pressed={profile.fpsTarget === f} onClick={() => update((p) => ({ ...p, fpsTarget: f }))}>{f} fps</button>)}</span>
        </div>
      ) : null}
      {profile.quality === 'auto' ? <p className="hint">15 fps looks best and moves slower, 60 fps moves smoothly and looks plainer.</p> : null}
      <GraphicsTuning tier={parseQuality(profile.quality) ?? tierInUse() ?? 'medium'} own={profile.graphics} onChange={(g) => update((p) => ({ ...p, graphics: g }))} />
      <label className="row">Graphics card <select value={profile.gpu} onChange={(e) => update((p) => ({ ...p, gpu: e.target.value as GpuChoice }))}><option value="fast">Ask for the fast one</option><option value="saver">Ask for the battery saver</option><option value="browser">Let the browser choose</option></select></label>
      <p className="hint">In use: {gpu ? tidyGpuName(gpu) : 'not known yet'}. A page can only ask: on a laptop with two graphics cards, Windows decides. To always get the fast one, open Windows Settings, System, Display, Graphics, pick your browser and choose High performance.</p>
      <label className="row"><input type="checkbox" checked={profile.grownUp} onChange={(e) => update((p) => ({ ...p, grownUp: e.target.checked }))} /> Grown-up mode (build mode on)</label>
      <p className="hint">Build mode is for adults. Switch it off for a kid profile: My Island and the activities stay, building is hidden.</p>
      <label className="row">Name <input value={profile.name} maxLength={20} onChange={(e) => update((p) => ({ ...p, name: e.target.value }))} /></label>
      <label className="row">Island skin <select value={profile.skin} onChange={(e) => update((p) => ({ ...p, skin: e.target.value as 'flat' | 'pbr' }))}><option value="flat">Flat (matches the voxel goblin)</option><option value="pbr">PBR (full relief)</option></select></label>
      <ControlsSettings value={profile.controls} onChange={(c) => update((p) => ({ ...p, controls: c }))} />
      <ControlsList />
      <div className="btns"><button onClick={props.onReplayTour}>Replay the tour</button><button className="danger" onClick={props.onReset}>Reset progress</button></div>
    </div>
  );
}
