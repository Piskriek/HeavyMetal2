const TIERS = ['gold', 'silver', 'bronze', 'iron'] as const;
const ORDINALS = ['1st', '2nd', '3rd', '4th'];

/**
 * TICKET-02: ornate live-position medallion. Gold/silver/bronze/iron metal
 * finishes mark 1st through 4th at a glance, replacing the text position stat.
 */
export default function PositionMedallion({ position, total = 4 }: { position: number; total?: number }) {
  const index = Math.min(Math.max(Math.round(position), 1), TIERS.length) - 1;
  return (
    <div className={`position-medallion tier-${TIERS[index]}`} role="status" aria-label={`Position ${index + 1} of ${total}`}>
      <span className="medallion-rank">{index + 1}<small>{ORDINALS[index].slice(1)}</small></span>
      <span className="medallion-caption">PLACE</span>
    </div>
  );
}
