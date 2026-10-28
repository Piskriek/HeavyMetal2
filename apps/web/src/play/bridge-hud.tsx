// Plan 53: the bridged game's live state on FIDELITY's HUD, while the bridge stage is up. The HUD's own vocabulary (the
// monster HUD's glass plate, Oxanium figures, sentence case), with the bridge's Ray-7 violet as its edge and as the square
// link lamp the game screen kit wears. Only the game moves it: a value that changes ticks violet once.

export interface BridgeHudProps {
  /** The bridged game's name. */
  readonly title: string;
  /** Its state, label to value, as its mapping's `hud` paths read it. */
  readonly state: Readonly<Record<string, string | number>>;
}

export function BridgeHud(props: BridgeHudProps) {
  const rows = Object.entries(props.state);
  return (
    <div className="mhud">
      <section className="mhud-plate mhud-bridge" data-hud-zone="right" aria-label={`${props.title}, bridged`} data-testid="bridge-hud">
        <p className="mhud-title"><i className="mhud-bridge-lamp" aria-hidden="true" />{props.title}</p>
        <dl className="mhud-bridge-state">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label[0]!.toUpperCase()}{label.slice(1)}</dt>
              <dd key={`${label}:${value}`}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
