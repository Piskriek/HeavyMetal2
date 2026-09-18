import { AnimatePresence, motion } from 'framer-motion';
import { capsuleById, riderById, type Loadout } from '../game/loadouts';
import { capsuleArt, riderFullBody } from '../game/loadout-art';

interface CharacterShowcaseProps {
  loadout: Loadout;
  /** `stage` is the lit pedestal on the selection screen, `summary` the compact lineup card. */
  variant?: 'stage' | 'summary';
  /** Decorative when the surrounding text already names the racer. */
  decorative?: boolean;
}

/**
 * TICKET-04 selection stage: the heroic full-body goblin stands proudly on the left of a
 * lit pedestal while the chosen standalone ball sits on the right with its own ground
 * shadow and a faint reflection. Swapping rider or ball crossfades the respective figure,
 * so every combination updates instantly without rebuilding a baked composite.
 */
export default function CharacterShowcase({ loadout, variant = 'stage', decorative = false }: CharacterShowcaseProps) {
  const rider = riderById(loadout.rider);
  const capsule = capsuleById(loadout.capsule);
  const label = `${rider.name} standing beside the ${capsule.name} ball`;
  return (
    <div
      className={`character-showcase showcase-${variant}`}
      role={decorative ? 'presentation' : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      <div className="showcase-figure" aria-hidden="true">
        <div className="showcase-rider-slot">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.img
              key={`rider-${rider.id}`}
              className="showcase-rider"
              src={riderFullBody(rider.id)}
              alt=""
              draggable={false}
              decoding="async"
              initial={{ opacity: 0, x: -14, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.98 }}
              transition={{ duration: 0.22 }}
            />
          </AnimatePresence>
          <div className="showcase-rider-shadow" />
        </div>
        <div className="showcase-ball-slot">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.img
              key={`ball-${capsule.id}`}
              className="showcase-ball"
              src={capsuleArt(capsule.id)}
              alt=""
              draggable={false}
              decoding="async"
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.22 }}
            />
          </AnimatePresence>
          <span className="showcase-gleam" aria-hidden="true" />
          <div className="showcase-ball-shadow" />
          <div className="showcase-ball-reflection" aria-hidden="true">
            <img key={`reflection-${capsule.id}`} src={capsuleArt(capsule.id)} alt="" draggable={false} />
          </div>
        </div>
      </div>
      <div className="showcase-pedestal" aria-hidden="true" />
    </div>
  );
}
