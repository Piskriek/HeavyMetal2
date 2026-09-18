import { useId } from 'react';
import { Check } from 'lucide-react';
import { POWERUPS, powerupIcon, type PowerupKind } from '../game/powerups';
import type { GameSnapshot } from '../game/types';

/**
 * TICKET-02: compact in-stage supply counter. Three glyph chips with charge
 * badges replace the wide annotated bar; full explanations live in the guide.
 */
export default function AirSupplies({ snapshot, className = '' }: { snapshot: GameSnapshot; className?: string }) {
  const recent = snapshot.raceTime < snapshot.pickupNoticeUntil;
  const shieldActive = snapshot.shieldSeconds > 0;
  const items: { kind: PowerupKind; count: string; live?: boolean }[] = [
    { kind: 'bounce', count: `${snapshot.bounces}` },
    { kind: 'fuel', count: `${snapshot.boosts}` },
    { kind: 'shield', count: shieldActive ? `${snapshot.shieldSeconds.toFixed(0)}s` : '—', live: shieldActive },
  ];
  return (
    <div className={`hud-supplies ${className}`} aria-label="Airborne supplies">
      {items.map(({ kind, count, live }) => {
        const definition = POWERUPS[kind];
        const justCollected = recent && snapshot.lastPickup === kind;
        return (
          <div key={kind} className={`supply-chip ${live ? 'active shield-live' : ''} ${justCollected ? 'just-collected' : ''}`} title={`${definition.name}: ${definition.description}`}>
            <img src={powerupIcon(kind)} alt={definition.name} />
            <span className="supply-count" aria-label={`${definition.name}: ${count}`}>{count}</span>
            {justCollected && <Check className="pickup-check" size={12} />}
          </div>
        );
      })}
      <span className="supply-total" title="Airborne supplies collected this race">{snapshot.pickups}<small>PICKED&nbsp;UP</small></span>
    </div>
  );
}

export function AirSupplyGuide() {
  const titleId = useId();
  return (
    <section className="air-supply-guide" aria-labelledby={titleId}>
      <h3 id={titleId}>Good things come from above.</h3>
      <p>Jump, bounce, or take a ramp through a floating supply. The first racer to touch it gets the item; rivals follow the same rules.</p>
      {(Object.keys(POWERUPS) as PowerupKind[]).map((kind) => <div key={kind} className="air-guide-row"><img src={powerupIcon(kind)} alt="" /><div><h4>{POWERUPS[kind].name}</h4><p>{POWERUPS[kind].description}</p></div></div>)}
      <p className="air-guide-note">Every pickup also awards 75 chaos points. Full supplies stay capped. A fresh shield refreshes its six-second timer; it does not stack. Blimps are scenery, not collision hazards.</p>
    </section>
  );
}
