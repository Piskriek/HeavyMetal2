import { racerLayers } from '../game/art-assets';
import { capsuleById, riderById, type Loadout } from '../game/loadouts';

interface RacerFigureProps {
  loadout: Loadout;
  className?: string;
  /** Decorative when the surrounding text already names the racer. */
  decorative?: boolean;
}

/**
 * A rider seated inside the painted capsule shell.
 *
 * The two PNGs are composited by the browser: the shell is drawn whole, and the pilot bust
 * is clipped to the hatch circle measured from the artwork by `scripts/build-art.mjs` and
 * positioned so its eye line sits on the hatch centre. That keeps one shell per capsule and
 * one pilot per rider instead of twelve baked combinations, and it stays crisp at any size.
 * The racing canvas path (`prepareRaceCapsules`) bakes the same geometry once per roster.
 */
export default function RacerFigure({ loadout, className = '', decorative = false }: RacerFigureProps) {
  const layers = racerLayers(loadout);
  const label = `${riderById(loadout.rider).name} inside the ${capsuleById(loadout.capsule).name} capsule`;
  return (
    <span className={`racer-figure ${className}`} role={decorative ? 'presentation' : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative ? true : undefined}>
      <img className="racer-shell" src={layers.shell} alt="" decoding="async" draggable={false} />
      <span className="racer-pilot-window" style={{ clipPath: layers.clip }}>
        <img
          className="racer-pilot" src={layers.pilot} alt="" decoding="async" draggable={false}
          style={{
            left: `${layers.pilotBox.left * 100}%`, top: `${layers.pilotBox.top * 100}%`,
            width: `${layers.pilotBox.width * 100}%`, height: `${layers.pilotBox.height * 100}%`,
          }}
        />
      </span>
    </span>
  );
}
