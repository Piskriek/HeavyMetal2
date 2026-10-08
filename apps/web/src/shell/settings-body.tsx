import type { ReactElement, ReactNode } from 'react';
import { FPS_TARGETS, parseQuality, tidyGpuName, type Quality } from '@hm/game';
import { resolveGraphics } from '@hm/render';
import { ControlsList, ControlsSettings } from './controls-list';
import { GraphicsTuning } from './graphics-tuning';
import { gpuInUse, tierInUse, type GpuChoice, type Profile } from './profile';
import { setPlaySettings, usePlaySettings } from './play-settings';

type Choice = 'auto' | Quality;
/** The dither distance's stops in metres, finer close by; the last one blends everywhere (stored as 0, as the graphics preset says). */
const DITHER_STOPS: readonly number[] = [2, 3, 4, 6, 8, 10, 15, 20, 30, 45, 60, 80, 100, 150, 200, 0];
const ditherStop = (m: number): number => (m <= 0 ? DITHER_STOPS.length - 1 : DITHER_STOPS.reduce((best, s, i) => (s > 0 && Math.abs(s - m) < Math.abs((DITHER_STOPS[best] ?? 0) - m) ? i : best), 0));
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
 * Settings: the settings presets, one body wherever Settings opens (the SetMix home, Goblin Racing, the island's Esc menu, a paused race),
 * in sections: Graphics (one click from Potato to Ultra, or Auto with a frame-rate target, then fine-tuning and the graphics card), Sound,
 * Controls, Racing, and You (name, grown-up mode, the island's look, the tour).
 */
export function SettingsBody(props: {
  readonly profile: Profile; readonly update: (fn: (p: Profile) => Profile) => void;
  /** Replay the tour and reset progress (left out where they make no sense, e.g. in a paused race). */
  readonly onReplayTour?: () => void; readonly onReset?: () => void;
  /** Open profile manager dialog. */
  readonly onManageProfiles?: () => void;
  /** Shown first (the island adds a jump to the lighting presets). */
  readonly top?: ReactNode;
}): ReactElement {
  const { profile, update } = props;
  const play = usePlaySettings();
  const picked = PRESETS.find((p) => p.id === profile.quality) ?? PRESETS[PRESETS.length - 1]!;
  const gpu = gpuInUse();
  // the dither distance as the tier in use draws it, with your change on top
  const dither = resolveGraphics(parseQuality(profile.quality) ?? tierInUse() ?? 'medium', profile.graphics).ditherDistance;
  const ditherSays = dither <= 0 ? 'Unlimited' : `${dither} m`;
  const volume = (field: 'master' | 'sfx' | 'music', label: string): ReactElement => (
    <label className="row slider">{label}<input type="range" min={0} max={100} step={1} value={Math.round(play[field] * 100)} aria-label={label} onChange={(e) => setPlaySettings({ [field]: Number(e.target.value) / 100 })} /><output>{Math.round(play[field] * 100)}%</output></label>
  );
  return (
    <div className="settings-body">
      {props.top}
      <section aria-label="Graphics">
        <h4>Graphics</h4>
        <div className="graphics-presets" role="group" aria-label="Graphics preset">
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
        <label className="row slider" data-ui="settings.dither">Dither distance<input type="range" min={0} max={DITHER_STOPS.length - 1} step={1} value={ditherStop(dither)} aria-label="Dither distance" aria-valuetext={ditherSays}
          onChange={(e) => { const m = DITHER_STOPS[Number(e.target.value)] ?? 0; update((p) => ({ ...p, graphics: { ...p.graphics, ditherDistance: m } })); }} /><output>{ditherSays}</output></label>
        <p className="hint">How far from you the voxel ground blends two surfaces pixel by pixel. Past it, each block shows one surface. Unlimited blends everywhere; far away it can shimmer.</p>
        <GraphicsTuning tier={parseQuality(profile.quality) ?? tierInUse() ?? 'medium'} own={profile.graphics} onChange={(g) => update((p) => ({ ...p, graphics: g }))} />
        <label className="row">Graphics card <select value={profile.gpu} onChange={(e) => update((p) => ({ ...p, gpu: e.target.value as GpuChoice }))}><option value="fast">Ask for the fast one</option><option value="saver">Ask for the battery saver</option><option value="browser">Let the browser choose</option></select></label>
        <p className="hint">In use: {gpu ? tidyGpuName(gpu) : 'not known yet'}. A page can only ask: on a laptop with two graphics cards, Windows decides. To always get the fast one, open Windows Settings, System, Display, Graphics, pick your browser and choose High performance.</p>
      </section>
      <section aria-label="Sound">
        <h4>Sound</h4>
        {volume('master', 'Everything')}
        {volume('sfx', 'Effects')}
        {volume('music', 'Music')}
      </section>
      <section aria-label="Controls">
        <h4>Controls</h4>
        <ControlsSettings value={profile.controls} onChange={(c) => update((p) => ({ ...p, controls: c }))} />
        <ControlsList />
      </section>
      <section aria-label="Racing">
        <h4>Racing</h4>
        <div className="row" role="group" aria-label="Touch controls">
          <span>Touch controls</span>
          <span className="seg">{(['auto', 'on', 'off'] as const).map((t) => <button key={t} className={play.touchControls === t ? 'on' : ''} aria-pressed={play.touchControls === t} onClick={() => setPlaySettings({ touchControls: t })}>{t === 'auto' ? 'On a touch screen' : t === 'on' ? 'Always' : 'Never'}</button>)}</span>
        </div>
        <label className="row"><input type="checkbox" checked={play.showMinimap} onChange={(e) => setPlaySettings({ showMinimap: e.target.checked })} /> Show the minimap</label>
        <label className="row"><input type="checkbox" checked={play.invertSteer} onChange={(e) => setPlaySettings({ invertSteer: e.target.checked })} /> Swap left and right steering</label>
      </section>
      <section aria-label="You">
        <h4>You</h4>
        <label className="row">Name <input value={profile.name} maxLength={20} onChange={(e) => update((p) => ({ ...p, name: e.target.value }))} /></label>
        <label className="row"><input type="checkbox" checked={profile.grownUp} onChange={(e) => update((p) => ({ ...p, grownUp: e.target.checked }))} /> Grown-up mode (build mode on)</label>
        <p className="hint">Build mode is for adults. Switch it off for a kid profile: My Island and the activities stay, building is hidden.</p>
        <label className="row">Island style <select value={profile.style} onChange={(e) => update((p) => ({ ...p, style: e.target.value as 'voxel' | 'painted' }))}><option value="voxel">Voxel (blocks that match the avatars)</option><option value="painted">Painted (the full ground)</option></select></label>
        <label className="row">Detail <select value={profile.skin} onChange={(e) => update((p) => ({ ...p, skin: e.target.value as 'flat' | 'pbr' }))}><option value="flat">Flat (plain colours, lighter)</option><option value="pbr">PBR (bumps, shine and height detail)</option></select></label>
        <label className="row"><input type="checkbox" checked={play.reducedMotion} onChange={(e) => setPlaySettings({ reducedMotion: e.target.checked })} /> Less motion (no camera swoops or bouncing menus)</label>
        {props.onManageProfiles ? (
          <div className="row">
            <span>Profiles</span>
            <button type="button" onClick={props.onManageProfiles} className="manage-profiles-btn">Manage profiles</button>
          </div>
        ) : null}
        {props.onReplayTour || props.onReset ? <div className="btns">{props.onReplayTour ? <button onClick={props.onReplayTour}>Replay the tour</button> : null}{props.onReset ? <button className="danger" onClick={props.onReset}>Reset progress</button> : null}</div> : null}
      </section>
    </div>
  );
}
