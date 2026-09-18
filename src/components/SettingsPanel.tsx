import { useEffect, useRef, useState } from 'react';
import { Check, Eye, Keyboard, Monitor, RotateCcw, Volume2 } from 'lucide-react';
import Modal from './Modal';
import ControlsSettings from './ControlsSettings';
import { GameAudio } from '../game/audio';
import { defaultOptions } from '../game/preferences';
import type { GameOptions } from '../game/types';

interface SettingsPanelProps {
  options: GameOptions;
  onChange: (options: GameOptions) => void;
  onClose: () => void;
}

export default function SettingsPanel({ options, onChange, onClose }: SettingsPanelProps) {
  const [tab, setTab] = useState<'display' | 'audio' | 'comfort' | 'controls'>('display');
  const [message, setMessage] = useState('');
  const testAudio = useRef<GameAudio | null>(null);
  useEffect(() => () => testAudio.current?.destroy(), []);
  const change = <K extends keyof GameOptions>(key: K, value: GameOptions[K]) => { onChange({ ...options, [key]: value }); setMessage('Settings saved'); };
  const toggle = (key: 'screenShake' | 'parallax' | 'aimAssist' | 'menuMotion' | 'reducedMotion' | 'highContrast' | 'sound', label: string, description: string) => (
    <div className="fantasy-setting-row" key={key}>
      <div><h3>{label}</h3><p>{description}</p></div>
      <button className={`rune-toggle ${options[key] ? 'is-on' : ''}`} role="switch" aria-checked={options[key]} aria-label={label} onClick={() => change(key, !options[key])}><span>{options[key] && <Check size={15} />}</span><small>{options[key] ? 'On' : 'Off'}</small></button>
    </div>
  );

  return (
    <Modal title="The Tinker's Settings" eyebrow="A FEW ADJUSTMENTS. NOTHING EXPLOSIVE." onClose={onClose} className="fantasy-dialog settings-dialog" wide backdrop="settings">
      <div className="fantasy-tabs" role="tablist" aria-label="Settings categories" onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const tabs = ['display', 'audio', 'comfort', 'controls'] as const;
        const next = (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        setTab(tabs[next]);
        event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
      }}>
        {([{ id: 'display', label: 'Display', icon: Monitor }, { id: 'audio', label: 'Sound', icon: Volume2 }, { id: 'comfort', label: 'Accessibility', icon: Eye }, { id: 'controls', label: 'Controls', icon: Keyboard }] as const).map(({ id, label, icon: Icon }) =>
          <button key={id} role="tab" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}
      </div>
      <div className="settings-page" role="tabpanel">
        {tab === 'display' && <>
          <div className="fantasy-setting-row"><div><h3><label htmlFor="menu-graphics">Graphics quality</label></h3><p>Auto balances detail and frame time for this device.</p></div><select id="menu-graphics" value={options.graphics} onChange={(event) => change('graphics', event.target.value as GameOptions['graphics'])}><option value="auto">Auto (recommended)</option><option value="performance">Performance</option><option value="quality">High detail</option></select></div>
          {toggle('menuMotion', 'Living menu', 'Slow background movement and a few drifting embers.')}
          {toggle('parallax', 'Background parallax', 'Give the mountains depth as the race moves downhill.')}
          <div className="fantasy-setting-row"><div><h3><label htmlFor="menu-camera">Race camera</label></h3><p>Choose the view that is most comfortable for you.</p></div><select id="menu-camera" value={options.downrange ? 'range' : 'side'} onChange={(event) => change('downrange', event.target.value === 'range')}><option value="range">Down-range</option><option value="side">Side view</option></select></div>
          <div className="fantasy-setting-row"><div><h3><label htmlFor="menu-ball-camera">Ball tracking</label></h3><p>Follow ball chases your capsule so it never leaves the screen. Fixed course holds the classic wide view, with an edge arrow when the ball exits.</p></div><select id="menu-ball-camera" value={options.cameraMode} onChange={(event) => change('cameraMode', event.target.value as GameOptions['cameraMode'])}><option value="follow_ball">Follow ball</option><option value="fixed">Fixed course</option></select></div>
          <p className="settings-footnote">Changes apply immediately. Graphics settings never reset your race.</p>
        </>}
        {tab === 'audio' && <>
          {toggle('sound', 'Game sound', 'Capsule clangs, rubber bands, explosions, and indignant sheep.')}
          <div className="fantasy-setting-row volume-setting"><div><h3><label htmlFor="master-volume">Master volume</label></h3><p>Control the volume of all game effects.</p></div><div className="volume-control"><input id="master-volume" type="range" min={0} max={100} step={5} value={options.masterVolume} onChange={(event) => change('masterVolume', Number(event.target.value))} /><output htmlFor="master-volume">{options.masterVolume}%</output></div></div>
          <button className="fantasy-secondary sound-test" disabled={!options.sound || options.masterVolume === 0} onClick={() => { testAudio.current ??= new GameAudio(); testAudio.current.setVolume(options.masterVolume); testAudio.current.setEnabled(true); testAudio.current.play('bump'); }}><Volume2 size={16} />Test sound</button>
          <p className="settings-footnote">Sound starts only after interaction. You can also mute it from the main menu.</p>
        </>}
        {tab === 'comfort' && <>
          {toggle('highContrast', 'High-contrast interface', 'Brighter text and stronger separation from the artwork.')}
          {toggle('reducedMotion', 'Reduced decorative motion', 'Stop menu drift and reduce nonessential race effects.')}
          {toggle('screenShake', 'Impact camera shake', 'A small camera kick when collisions or TNT hit.')}
          {toggle('aimAssist', 'Show launch trajectory', 'Preview the arc before releasing your capsule.')}
          <p className="settings-footnote">Your system's reduced-motion preference is also respected. All menus support keyboard navigation.</p>
        </>}
        {tab === 'controls' && <ControlsSettings />}
      </div>
      <div className="fantasy-dialog-actions">
        <button className="fantasy-link" onClick={() => { const defaults = defaultOptions(); onChange({ ...options, sound: defaults.sound, masterVolume: defaults.masterVolume, graphics: defaults.graphics, screenShake: defaults.screenShake, menuMotion: defaults.menuMotion, reducedMotion: defaults.reducedMotion, highContrast: defaults.highContrast, parallax: defaults.parallax, downrange: defaults.downrange, aimAssist: defaults.aimAssist }); setMessage('Display, sound, and accessibility defaults restored. Race records were kept.'); }}><RotateCcw size={14} />Restore defaults</button>
        <span className="save-status" role="status">{message || 'Saved on this device'}</span>
        <button className="fantasy-primary" onClick={onClose}>Back to the Game <Check size={16} /></button>
      </div>
    </Modal>
  );
}