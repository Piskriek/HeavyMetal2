import { useEffect, useRef, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Compass, Maximize2, Paintbrush, Play, Settings, Trophy, UserRound, Volume2, VolumeX } from 'lucide-react';
import Brand from './Brand';
import AnimatedMenuBackground from './ui/AnimatedMenuBackground';
import type { GameOptions } from '../game/types';

interface MainMenuProps {
  options: GameOptions;
  hasRace: boolean;
  resumeLabel?: string;
  /** Recovery message for the durable event, e.g. an interrupted round restarting. */
  resumeNote?: string | null;
  /** Set when this browser refuses to store progress; never claim otherwise. */
  storageWarning?: string | null;
  onNewGame: () => void;
  onResume: () => void;
  onMapEditor: () => void;
  onSettings: () => void;
  onGuide: () => void;
  onRecords: () => void;
  /** MP-T06: the goblin creator. */
  onCreator?: () => void;
  /** MP-T04: the ball garage. */
  onGarage?: () => void;
  onCredits: () => void;
  onSound: () => void;
  onFullscreen: () => void;
}

export default function MainMenu(props: MainMenuProps) {
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!document.querySelector('[role="dialog"]')) navigation.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, []);
  const moveFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...(navigation.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    if (!buttons.length) return;
    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  };
  useEffect(() => {
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]') || event.defaultPrevented) return;
      if (event.key === 'Escape' && props.hasRace) { event.preventDefault(); props.onResume(); }
      if (event.key === 'Enter' && !['BUTTON', 'A', 'INPUT', 'SELECT'].includes((event.target as HTMLElement).tagName)) {
        event.preventDefault(); navigation.current?.querySelector<HTMLButtonElement>('button')?.click();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [props.hasRace, props.onResume]);

  const FlagIcon = () => <img src="/art/flag-checkered.png" alt="" className="menu-flag-icon" aria-hidden="true" />;

  const entries = [
    ...(props.hasRace ? [{ label: props.resumeLabel ?? 'Resume Race', sub: 'Your goblin is waiting.', icon: Play, action: props.onResume, primary: true }] : []),
    { label: 'New Game', sub: props.hasRace ? 'Start a new event. The current one is replaced.' : 'A fresh start. The same bad judgment.', icon: FlagIcon, action: props.onNewGame, primary: !props.hasRace },
    { label: '3D Map Editor', sub: 'Design custom tracks, place props, and test drive.', icon: Compass, action: props.onMapEditor, primary: false },
    { label: 'Settings', sub: 'A little fine-tuning never hurt.', icon: Settings, action: props.onSettings, primary: false },
    { label: 'How to Play', sub: 'The very optional instruction manual.', icon: BookOpen, action: props.onGuide, primary: false },
    ...(props.onCreator ? [{ label: 'Goblin Creator', sub: 'Build your racer, face and all. Save it to your crew.', icon: UserRound, action: props.onCreator, primary: false }] : []),
    ...(props.onGarage ? [{ label: 'Ball Garage', sub: 'Paint your ball: metal, pin-lines and up to twelve decals.', icon: Paintbrush, action: props.onGarage, primary: false }] : []),
    { label: 'Hall of Chaos', sub: 'Some things deserve to be remembered.', icon: Trophy, action: props.onRecords, primary: false },
  ];

  return (
    <main className="main-menu" data-motion={props.options.menuMotion && !props.options.reducedMotion} data-resumable={props.hasRace} aria-labelledby="menu-title">
      <AnimatedMenuBackground preset="main" motionActive={props.options.menuMotion && !props.options.reducedMotion} />
      <div className="menu-grain" aria-hidden="true" />
      <div className="menu-topline">
        <div className="studio-signature"><Brand variant="emblem" decorative /><span>HEAVY METAL WORKS<small>Purveyors of exceptionally bad ideas</small></span></div>
        <div className="menu-utilities">
          <button className="forged-icon" onClick={props.onSound} aria-label={props.options.sound ? 'Mute sound' : 'Enable sound'} title={props.options.sound ? 'Mute sound' : 'Enable sound'}>{props.options.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button className="forged-icon" onClick={props.onFullscreen} aria-label="Toggle fullscreen" title="Fullscreen"><Maximize2 size={17} /></button>
        </div>
      </div>

      <motion.div className="menu-composition" data-resume-note={Boolean(props.hasRace && props.resumeNote)} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
        <div className="game-wordmark">
          <h1 id="menu-title" className="visually-hidden">Heavy Metal GP 2</h1>
          <Brand variant="hero" />
          <p>Glory at the bottom. Trouble all the way down.</p>
        </div>

        {props.hasRace && props.resumeNote && <p className="menu-resume-note" role="status"><img src="/art/flag-checkered.png" alt="" className="menu-resume-flag-img" aria-hidden="true" />{props.resumeNote}</p>}
        <nav ref={navigation} className="main-menu-actions" aria-label="Main menu" onKeyDown={moveFocus}>
          {entries.map(({ label, icon: Icon, action, primary }, index) => (
            <motion.button key={label} className={`forged-menu-button ${primary ? 'forged-primary' : ''}`} onClick={action}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + index * 0.06, duration: 0.3 }}>
              <span className="button-rivet rivet-left" aria-hidden="true" /><Icon size={19} strokeWidth={1.5} />
              <span>{label}</span><ArrowRight className="menu-action-arrow" size={17} /><span className="button-rivet rivet-right" aria-hidden="true" />
            </motion.button>
          ))}
        </nav>
        <div className="menu-bottom-flourish"><span /><i /><span /></div>
        <p className="menu-motto">FOUR GOBLINS. NO BRAKES. NO REFUNDS.</p>
      </motion.div>

      <footer className="menu-footer">
        {props.storageWarning ? <p className="menu-storage-warning" role="status">{props.storageWarning}</p> : null}
        <div className="menu-input-hints"><span><kbd>Enter</kbd> Select</span><span><kbd>Tab</kbd> Navigate</span>{props.hasRace && <span><kbd>Esc</kbd> Resume</span>}</div>
        <span className="menu-build">LOCAL PLAY <i /> BUILD 0.4.3</span>
      </footer>
    </main>
  );
}