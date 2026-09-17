import { useId } from 'react';
import { Check, PackageOpen } from 'lucide-react';
import { POWERUPS, powerupIcon, type PowerupKind } from '../game/powerups';
import type { GameSnapshot } from '../game/types';

export default function AirSupplies({ snapshot }: { snapshot: GameSnapshot }) {
  const recent = snapshot.raceTime < snapshot.pickupNoticeUntil;
  return (
    <div className="air-supplies" aria-label="Airborne powerups">
      <span className="air-supplies-title"><PackageOpen size={13} />AIR SUPPLIES</span>
      <div className="air-supplies-items">
        {(Object.keys(POWERUPS) as PowerupKind[]).map((kind) => {
          const definition = POWERUPS[kind];
          const active = kind === 'shield' && snapshot.shieldSeconds > 0;
          return <div key={kind} className={`air-supply-item ${active ? 'active' : ''} ${recent && snapshot.lastPickup === kind ? 'just-collected' : ''}`} title={definition.description}>
            <img src={powerupIcon(kind)} alt="" /><span>{kind === 'fuel' ? 'Rocket Fuel' : kind === 'shield' ? 'Skyward Shield' : 'Air Spring'}<small>{active ? `${snapshot.shieldSeconds.toFixed(1)}s / one hit` : definition.label}</small></span>
            {active && <div className="shield-duration" role="meter" aria-label="Shield time remaining" aria-valuemin={0} aria-valuemax={6} aria-valuenow={snapshot.shieldSeconds}><span style={{ height: `${snapshot.shieldSeconds / 6 * 100}%` }} /></div>}
            {recent && snapshot.lastPickup === kind && <Check className="pickup-check" size={12} />}
          </div>;
        })}
      </div>
      <span className="pickup-count">{snapshot.pickups}<small>collected</small></span>
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