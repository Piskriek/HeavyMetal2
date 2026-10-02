import type { ReactElement } from 'react';
import { rootClass } from './styles';

export const TIPS: readonly string[] = [
  'Heavy goblins grip the road but take a while to get going.',
  'Boost pads glow cyan. Roll over one and you get a burst of speed.',
  'Hold the item button for a split second before the corner, not in it.',
  'Rumble strips are red and white. They are bumpy, so stay on the tarmac.',
  'Oil slicks send everyone sliding. Drop one behind you when someone is close.',
  'The anchor makes you unshakeable for a few seconds. Nothing can push you around.',
  'A ghost goblin slips through shockwaves and slicks alike.',
  'Springy goblins bounce off walls instead of stopping dead.',
  'If you get stuck, press R to hop back onto the road.',
  'Cutting across the infield does not count as a lap. The checkpoints know.',
  'Dry tarmac is fast. Sand and grass will slow your ball right down.',
  'Fall off the island? Your goblin pops back on the road after a moment.',
  'Every sound in the game can be edited in the Map Maker.',
  'Build your own island, press Test drive, and race it right away.',
];

/** A tip for a seed: the same seed always gives the same tip, and any number (negative, fractional) is fine. */
export function tipFor(seed: number): string {
  const n = Number.isFinite(seed) ? Math.floor(seed) : 0;
  return TIPS[((n % TIPS.length) + TIPS.length) % TIPS.length]!;
}

export function LoadingScreen(props: { progress: number; tip?: string; title?: string; reducedMotion?: boolean }): ReactElement {
  const pct = Math.round(Math.min(1, Math.max(0, Number.isFinite(props.progress) ? props.progress : 0)) * 100);
  return (
    <div className={rootClass('bg', props.reducedMotion)} data-screen="loading">
      <h2>{props.title ?? 'Loading Basalt Isle'}</h2>
      <div className="hms-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Loading"><b style={{ width: `${pct}%` }} /></div>
      <p className="hms-hint" style={{ fontStyle: 'italic', maxWidth: 420 }}>{props.tip ?? tipFor(0)}</p>
    </div>
  );
}
