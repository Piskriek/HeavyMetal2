// The build menu (B, TASK-20): one menu with four tabs. Machines are the plot's field machines (the first hour's mill, drill
// and pylon). Structures are the blueprint kinds you hold (the TASK-13 pieces). Heavy machines go on a hardpoint. Plans are
// the layouts you saved. Each tab has one telemetry colour, so the tab you are on reads at a glance. Pure presentation: the
// screen (play.tsx) builds the rows and does the actions.
import type { CSSProperties, ReactElement } from 'react';

export type BuildTab = 'machines' | 'structures' | 'heavy' | 'plans';
const TABS: readonly { readonly id: BuildTab; readonly label: string; readonly colour: string }[] = [
  { id: 'machines', label: 'Machines', colour: '#ff3d8a' },
  { id: 'structures', label: 'Structures', colour: '#22d3ee' },
  { id: 'heavy', label: 'Heavy', colour: '#ffb02a' },
  { id: 'plans', label: 'Plans', colour: '#a78bfa' },
];

/** The player's name for each structure kind (the blueprint pieces and the fixtures). */
export const KIND_LABEL: Readonly<Record<string, string>> = {
  foundation: 'Foundation', floor: 'Floor', wall: 'Wall', lowRoof: 'Low roof', bench: 'Bench', weaponBench: 'Weapon bench', bin: 'Bin',
  halfWall: 'Half wall', windowWall: 'Window wall', doorframe: 'Doorframe', door: 'Door', gable: 'Gable', pillar: 'Pillar', repeater: 'Repeater',
  ramp: 'Ramp', stairs: 'Stairs', roof: 'Roof', roofOuter: 'Outer roof', roofInner: 'Inner roof', ridgeCap: 'Ridge cap', airlock: 'Airlock',
  hardpoint: 'Hardpoint', lifeSupport: 'Life support',
};

export interface MenuMachine { readonly key: string; readonly name: string; readonly blurb: string; readonly cost: string; readonly shut: boolean; readonly short: boolean; readonly highlighted: boolean; readonly unlock: number }
export interface MenuKind { readonly kind: string; readonly label: string; readonly cost: string }
export interface MenuBlueprint { readonly id: string; readonly name: string; readonly slot: number | null; readonly kinds: readonly MenuKind[] }
export interface MenuHeavy { readonly kind: string; readonly name: string; readonly blurb: string }
export interface MenuLayout { readonly id: string; readonly name: string; readonly pieces: number }

export interface BuildMenuProps {
  readonly tab: BuildTab;
  readonly onTab: (tab: BuildTab) => void;
  readonly stage: number;
  readonly machines: readonly MenuMachine[];
  readonly blueprints: readonly MenuBlueprint[];
  /** The kind the held blueprint builds next (the one the ghost shows). */
  readonly selectedKind: string | null;
  readonly heavy: readonly MenuHeavy[];
  readonly hardpoints: number;
  readonly aimedHardpoint: boolean;
  readonly layouts: readonly MenuLayout[];
  readonly onMachine: (key: string) => void;
  readonly onStructure: (blueprintId: string, kind: string) => void;
  readonly onHeavy: () => void;
  readonly onLayout: (id: string) => void;
  readonly onClose: () => void;
}

const empty = (text: string): ReactElement => <p className="bm-empty">{text}</p>;

export function BuildMenu(props: BuildMenuProps): ReactElement {
  const counts: Record<BuildTab, number> = {
    machines: props.machines.filter((m) => !m.shut).length,
    structures: props.blueprints.reduce((n, b) => n + b.kinds.length, 0),
    heavy: props.hardpoints,
    plans: props.layouts.length,
  };
  const colour = TABS.find((t) => t.id === props.tab)!.colour;
  return (
    <section className="play-build bm" aria-label="Build" style={{ '--tab': colour } as CSSProperties}>
      <header className="bm-head">
        <h3>Build</h3>
        <button type="button" className="bm-close" onClick={props.onClose} aria-label="Close the build menu">Esc</button>
      </header>
      <div className="bm-tabs" role="tablist" aria-label="Build categories">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`bm-tab-${t.id}`}
            aria-selected={props.tab === t.id}
            aria-controls="bm-panel"
            className={`bm-tab${props.tab === t.id ? ' on' : ''}`}
            style={{ '--c': t.colour } as CSSProperties}
            onClick={() => props.onTab(t.id)}
          >
            <span>{t.label}</span>
            <b>{counts[t.id]}</b>
          </button>
        ))}
      </div>

      <div id="bm-panel" role="tabpanel" aria-labelledby={`bm-tab-${props.tab}`} className="bm-panel">
        {props.tab === 'machines' ? (
          <>
            <div className="play-cards">
              {props.machines.map((m) => (
                <button key={m.key} type="button" className={`play-card${m.shut ? ' shut' : ''}${m.short ? ' short' : ''}${m.highlighted ? ' highlighted' : ''}`} disabled={m.shut} onClick={() => props.onMachine(m.key)}>
                  <b>{m.name}</b>
                  <span>{m.blurb}</span>
                  <em>{m.shut ? `Unlocks at stage ${m.unlock}` : m.cost}</em>
                </button>
              ))}
            </div>
            <p>Machines run on power from the gate&rsquo;s junction box or a relay pylon; most use ore, which rock drills mine.</p>
          </>
        ) : null}

        {props.tab === 'structures' ? (
          props.blueprints.length === 0 ? empty('Nothing to build with yet. Draft a blueprint at the Drafting Table (K).') : (
            <div className="bm-groups">
              {props.blueprints.map((b) => (
                <div key={b.id} className="bm-group">
                  <h4>{b.name}{b.slot === null ? <em> · not in the hotbar</em> : <em> · slot {b.slot + 1}</em>}</h4>
                  <div className="bm-chips">
                    {b.kinds.map((k) => (
                      <button key={k.kind} type="button" className={`bm-chip${props.selectedKind === k.kind && b.slot !== null ? ' on' : ''}`} onClick={() => props.onStructure(b.id, k.kind)}>
                        <span>{k.label}</span>
                        <em>{k.cost}</em>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p>Click a piece to hold it: the blueprint goes to the hotbar and the ghost follows the aim. Wheel or Q cycles the kinds.</p>
            </div>
          )
        ) : null}

        {props.tab === 'heavy' ? (
          <>
            <div className="play-cards">
              {props.heavy.map((h) => (
                <button key={h.kind} type="button" className="play-card" onClick={props.onHeavy} disabled={props.hardpoints === 0}>
                  <b>{h.name}</b>
                  <span>{h.blurb}</span>
                  <em>{props.aimedHardpoint ? 'Aimed: press to install' : props.hardpoints > 0 ? 'Aim at a hardpoint, then press' : 'Needs a hardpoint'}</em>
                </button>
              ))}
            </div>
            {props.hardpoints === 0 ? <p>Build a hardpoint from the Structures tab (the chassis kit). Heavy machines are installed on it, and run on its power.</p> : null}
          </>
        ) : null}

        {props.tab === 'plans' ? (
          props.layouts.length === 0 ? empty('No layouts yet. Save one at the Drafting Table (K), then place it here.') : (
            <div className="play-cards">
              {props.layouts.map((l) => (
                <button key={l.id} type="button" className="play-card" onClick={() => props.onLayout(l.id)}>
                  <b>{l.name}</b>
                  <span>{l.pieces} pieces, built from the plan you lay down.</span>
                  <em>Place in the world</em>
                </button>
              ))}
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}
