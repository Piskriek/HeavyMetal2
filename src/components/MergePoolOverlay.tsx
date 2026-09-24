/**
 * M01 · T2 — the first-loop pool overlay.
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
import { capsuleById, riderById, type Loadout } from '../game/loadouts';
import '../merge-pool-overlay.css';

export interface MergePoolOverlayProps {
  /** Present from the first gate crossing until the last rider is released. */
  merge: MergeSnapshot;
  /** The player's loadout, named under the queue so the panel says who is driving. */
  loadout?: Loadout | null;
  /** Space, Enter or the button: the player is ready to go. */
  onReady: () => void;
}

/** The one flag worth a word on the row, most specific first. */
function flagLabel(flags: readonly string[]): string | null {
  if (flags.includes('autoReady')) return 'AUTO';
  if (flags.includes('forced')) return 'FORCED';
  if (flags.includes('delayed')) return 'HELD UP';
  if (flags.includes('alignForced')) return 'OFF-LINE';
  if (flags.includes('late')) return 'LATE';
  return null;
}

export default function MergePoolOverlay({ merge, loadout, onReady }: MergePoolOverlayProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const focused = useRef(false);
  const releasing = merge.phase === 'releasing';
  const player = merge.entries.find((entry) => entry.isPlayer) ?? null;

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
      aria-label="First loop pool"
    >
      {releasing ? (
        merge.countdownLabel ? (
          <div className="merge-pool__go" role="status" aria-live="assertive">{merge.countdownLabel}</div>
        ) : null
      ) : (
        <>
          <div className="merge-pool__go" role="status" aria-live="assertive">
            {merge.countdownLabel ?? (merge.phase === 'open' ? 'POOL' : 'READY')}
          </div>
          <div className="merge-pool__panel">
            <header className="merge-pool__head">
              <div>
                <h2>The first loop</h2>
                <p>
                  {merge.phase === 'open'
                    ? 'Everyone queues in the order they arrive. Nobody passes inside the ring.'
                    : 'All in. The ring takes them in order — first in, first out.'}
                </p>
              </div>
              <span className="merge-pool__hold" title="Simulated ticks spent queued">
                {merge.holdTicks} ticks held
              </span>
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
                    <span className="merge-pool__time">{entry.entryTime.toFixed(2)}s</span>
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
                className="merge-pool__button"
                onClick={onReady}
                disabled={!player || player.ready}
              >
                {player?.ready ? 'READY — WAITING ON THE FIELD' : 'READY UP'}
              </button>
              <p className="merge-pool__hint">
                Space or Enter also readies up. An idle rider is readied automatically and keeps their place.
              </p>
            </footer>
          </div>
        </>
      )}
    </div>
  );
}
