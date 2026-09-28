/**
 * M01 · T2 / T1c — the sorting-loop pool overlay.
 *
 * Shown while the pool owns the race status: the queue as it stands (place, rider, when they
 * crossed, whether they are ready), the countdown once the window closes, and the player's own
 * READY button. Once the releases start the panel gets out of the way — a rider who is already
 * racing should not be reading a queue — and only `GO!` is left on screen.
 *
 * Presentation only: the overlay reads the engine's snapshot and calls back. It owns no timers and
 * no state beyond the one-shot focus latch, so the queue it shows is always the simulation's own.
 */
import { useEffect, useRef } from 'react';
import type { MergeSnapshot } from '../game/types';
import { COCKPIT_ART } from '../game/cockpit';
import { poolGoblinFrame, poolGoblinSheetPosition } from '../game/merge/goblin';
import { formatSplit, poolIsWaiting } from '../game/merge/split';
import { capsuleById, riderById, type Loadout } from '../game/loadouts';
import OrnateCorners from './OrnateCorners';
import '../merge-pool-overlay.css';

export interface MergePoolOverlayProps {
  /** Present from the first gate crossing until the last rider is released. */
  merge: MergeSnapshot;
  /** The player's loadout, named under the queue so the panel says who is driving. */
  loadout?: Loadout | null;
  /** Space, Enter or the button: the player is ready to go. */
  onReady: () => void;
  /**
   * The run clock, in seconds. The player's first split is set by the run down to the loop, so while
   * they are still on it the overlay shows the clock instead of a queue they are not in.
   */
  raceTime?: number;
  /** Reduced motion holds each pose instead of animating the sweep. */
  reducedMotion?: boolean;
}

/** The pool counts in physics ticks; the sim runs at 120 of them a second. */
const TICKS_PER_SECOND = 120;
const heldLabel = (ticks: number) => `Race clock held ${(ticks / TICKS_PER_SECOND).toFixed(1)} s`;

/** The one flag worth a word on the row, most specific first. */
function flagLabel(flags: readonly string[]): string | null {
  if (flags.includes('autoReady')) return 'AUTO';
  if (flags.includes('forced')) return 'FORCED';
  if (flags.includes('delayed')) return 'HELD UP';
  if (flags.includes('alignForced')) return 'OFF-LINE';
  if (flags.includes('late')) return 'LATE';
  return null;
}

export default function MergePoolOverlay({
  merge, loadout, onReady, reducedMotion = false, raceTime = 0,
}: MergePoolOverlayProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const goblinRef = useRef<HTMLDivElement | null>(null);
  const focused = useRef(false);
  const releasing = merge.phase === 'releasing';
  const goActive = releasing && merge.countdownLabel !== null;
  const player = merge.entries.find((entry) => entry.isPlayer) ?? null;
  // Still on the way down: the field is queuing, but the player's split is not set yet. The panel
  // that asks them to ready up is not shown until they are actually in the pool (their own entry
  // exists), so nothing is offered, auto-readied or released out from under the run.
  const waiting = poolIsWaiting(merge.entries);

  // One animation loop for the goblin, and it writes only when the cell actually changes: the sheet
  // is a background position, so a 12 fps character costs one style write every fifth frame.
  useEffect(() => {
    let frameId = 0;
    let last = -1;
    const start = performance.now();
    const step = (now: number) => {
      const element = goblinRef.current;
      if (element) {
        const cell = poolGoblinFrame(merge.phase, goActive, (now - start) / 1000, reducedMotion);
        if (cell !== last) {
          last = cell;
          const position = poolGoblinSheetPosition(cell);
          element.style.backgroundPosition = `${position.x}% ${position.y}%`;
        }
      }
      frameId = requestAnimationFrame(step);
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [merge.phase, goActive, reducedMotion]);

  // The countdown gets the player's attention automatically, once: when the window closes on a
  // player who has not readied, the button takes focus so Space/Enter are already aimed at it.
  useEffect(() => {
    if (focused.current) return;
    if (merge.phase !== 'closed' || !player || player.ready) return;
    focused.current = true;
    buttonRef.current?.focus({ preventScroll: true });
  }, [merge.phase, player]);

  return (
    <div
      className={`merge-pool${releasing ? ' merge-pool--releasing' : ''}`}
      data-phase={merge.phase}
      role="dialog"
      aria-label="Sorting loop pool"
    >
      {/* The pool goblin: hold, call, count, and the sweep that sends them off. Painted art on a 2x2
          sheet, its cell chosen by the phase (see game/merge/goblin.ts). */}
      <div
        className="merge-pool__goblin"
        ref={goblinRef}
        style={{ backgroundImage: `url(${COCKPIT_ART.poolGoblin})` }}
        aria-hidden="true"
      />
      {releasing ? (
        merge.countdownLabel ? (
          <div className="merge-pool__go" role="status" aria-live="assertive">{merge.countdownLabel}</div>
        ) : null
      ) : waiting ? (
        // The split board: the run to the loop is still being set, so the clock is the only number
        // that matters and the field's queue is shown as news, not as a place to claim.
        <>
          <div className="merge-pool__go" role="status" aria-live="polite">{merge.countdownLabel ?? 'POOL'}</div>
          <div className="merge-pool__panel merge-pool__panel--waiting">
            <OrnateCorners />
            <header className="merge-pool__head">
              <span className="merge-pool__eyebrow">First loop · the sorting pool</span>
              <h2>Set your split</h2>
              <p>The field is queuing at the loop. Your clock is still running until you cross the gate.</p>
            </header>

            <div className="merge-pool__split">
              <span className="merge-pool__split-label">Your split so far</span>
              <strong className="merge-pool__split-clock" data-testid="pool-split-clock">{formatSplit(raceTime)}</strong>
              <span className="merge-pool__split-note">Ready up once you are in the pool.</span>
            </div>

            <ol className="merge-pool__list merge-pool__list--waiting" aria-label="The field is queuing">
              {merge.entries.map((entry) => (
                <li key={entry.id} className="merge-pool__row">
                  <span className="merge-pool__place">{entry.position}</span>
                  <span className="merge-pool__swatch" style={{ background: entry.color }} aria-hidden="true" />
                  <span className="merge-pool__name">{entry.name}</span>
                  <span className="merge-pool__time">{formatSplit(entry.entryTime)}</span>
                  <span className={`merge-pool__ready merge-pool__ready--${entry.released ? 'out' : entry.ready ? 'on' : 'off'}`}>
                    {entry.released ? 'LOOP' : entry.ready ? 'READY' : 'WAITING'}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : (
        <>
          <div className="merge-pool__go" role="status" aria-live="assertive">
            {merge.countdownLabel ?? (merge.phase === 'open' ? 'POOL' : 'READY')}
          </div>
          <div className="merge-pool__panel">
            <OrnateCorners />
            <header className="merge-pool__head">
              <span className="merge-pool__eyebrow">First loop · the sorting pool</span>
              <h2>The sorting loop</h2>
              <p>
                {merge.phase === 'open'
                  ? 'Everyone queues in the order they arrived. Nobody passes inside the ring.'
                  : 'All in. The ring sends them out in order: first in, first out.'}
              </p>
              <span className="merge-pool__hold" title="Queuing time is taken off the race clock">{heldLabel(merge.holdTicks)}</span>
            </header>

            <ol className="merge-pool__list">
              {merge.entries.map((entry) => {
                const flag = flagLabel(entry.flags);
                return (
                  <li
                    key={entry.id}
                    className={`merge-pool__row${entry.isPlayer ? ' merge-pool__row--player' : ''}${entry.released ? ' merge-pool__row--released' : ''}`}
                  >
                    <span className="merge-pool__place">{entry.position}</span>
                    <span className="merge-pool__swatch" style={{ background: entry.color }} aria-hidden="true" />
                    <span className="merge-pool__name">
                      {entry.name}
                      {entry.isPlayer && <em>YOU</em>}
                    </span>
                    <span className="merge-pool__time">{formatSplit(entry.entryTime)}</span>
                    <span className={`merge-pool__ready merge-pool__ready--${entry.released ? 'out' : entry.ready ? 'on' : 'off'}`}>
                      {entry.released ? 'LOOP' : entry.ready ? 'READY' : 'WAITING'}
                    </span>
                    {flag && <span className="merge-pool__flag">{flag}</span>}
                  </li>
                );
              })}
            </ol>

            <footer className="merge-pool__foot">
              {loadout && (
                <p className="merge-pool__loadout">
                  {riderById(loadout.rider).name} • {capsuleById(loadout.capsule).name}
                </p>
              )}
              <button
                ref={buttonRef}
                type="button"
                className="fantasy-primary merge-pool__button"
                onClick={onReady}
                disabled={!player || player.ready}
              >
                {player?.ready ? 'Ready. Waiting on the field' : 'Ready up'}
              </button>
              <p className="merge-pool__hint">
                Space or Enter works too. If you wait, you are readied automatically and keep your place.
              </p>
            </footer>
          </div>
        </>
      )}
    </div>
  );
}
