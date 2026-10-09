import { Fragment, type ReactElement, type Ref } from 'react';
import { Maximize2 } from 'lucide-react';
import { EDITION, type Edition } from '../edition';

/**
 * Goblin Racing's front: its own menu (Play, Race modes, Settings) over its island. On the SetMix home it is a live window beside its planet
 * (GoblinPreview); opening it lets the same window grow to fill the screen (GoblinFront). Goblin words live here, not in the harness.
 * Every line on these screens tells the player something they need: what the game is, what Play will do, who they race as.
 */
export interface GoblinStatus {
  /** One line about the game (the activity's own description). */
  readonly doc: string;
  /** Where the player stands: who they race as, or what Play will do the first time. */
  readonly you: string;
}

/** A planet's live window on the SetMix home (Goblin Racing, or any activity): its name, what it is, where you stand, its own menu. */
export function GoblinPreview(props: GoblinStatus & {
  readonly name?: string; readonly onOpen: () => void;
  readonly actions: readonly { readonly label: string; readonly onClick: () => void; readonly go?: boolean }[];
  /** The island view behind the window has not drawn yet: a loading bar instead of an empty frame. */
  readonly loading?: boolean;
}): ReactElement {
  const name = props.name ?? 'Goblin Racing';
  return (
    <div className="gr-preview">
      <header>
        <div className="gr-preview-title"><span className="gr-preview-name">{name}</span><span className="gr-preview-doc">{props.doc}</span></div>
        <button className="gr-open" aria-label={`Open ${name}`} title={`Open ${name}`} onClick={props.onOpen}><Maximize2 size={16} strokeWidth={1.6} /></button>
      </header>
      {/* the island itself opens the game: a cue says so on hover */}
      <button className="gr-preview-hit" aria-label={`Open ${name}`} onClick={props.onOpen}><span className="gr-cue"><Maximize2 size={13} strokeWidth={1.8} />Open {name}</span></button>
      {props.loading ? <div className="gr-loading" role="status"><span>Loading the island</span><i /></div> : null}
      <p className="gr-preview-you">{props.you}</p>
      <nav className="gr-preview-menu" aria-label={`${name} menu`}>
        {props.actions.map((a) => <button key={a.label} className={a.go ? 'go' : ''} onClick={a.onClick}>{a.label}</button>)}
      </nav>
    </div>
  );
}

export function GoblinFront(props: GoblinStatus & { readonly onPlay: () => void; readonly onModes: () => void; readonly onSettings: () => void; readonly onHome: () => void }): ReactElement {
  return (
    <div className="gr-front">
      <div className="gr-scrim" aria-hidden="true" />
      <div className="gr-brand"><b>Goblin</b><b className="second">Racing</b><i>a SetMix game</i></div>
      <nav className="shell-menu" aria-label="Goblin Racing menu">
        <button className="go" onClick={props.onPlay}>Play</button>
        <button onClick={props.onModes}>Race modes</button>
        <button onClick={props.onSettings}>Settings</button>
        <button className="quiet" onClick={props.onHome}>Back to SetMix</button>
      </nav>
      <p className="shell-foot">{props.you}</p>
    </div>
  );
}

export type MenuId =
  | 'expedition'
  | 'grid'
  | 'fabricator'
  | 'studio'
  | 'workshop'
  | 'community'
  | 'settings'
  | 'racing'
  | 'play'
  | 'island'
  | 'avatars';

export interface MenuItem {
  readonly id: MenuId;
  readonly label: string;
  readonly says: string;
  readonly badge?: string;
}

const FIDELITY_MENU: readonly MenuItem[] = [
  { id: 'expedition', label: 'Expedition', says: 'Singleplayer campaign (desynced): private local simulation branch. Play solo/offline.', badge: 'DESYNCED' },
  { id: 'grid', label: 'Planetary Grid', says: 'Multiplayer campaign (synced): shared 40,000 km world. Majority rules merging.', badge: 'SYNCED' },
  { id: 'studio', label: 'The Studio', says: 'In-engine world & schema editor. Terrain sculpting, machine placement & test drive.', badge: 'EDITOR' },
  { id: 'workshop', label: 'The Workshop', says: 'Game bridging manager: ingest WAD/PAK/MD2, calibrate vehicle & weapon adapters.' },
  { id: 'community', label: 'Community Nexus', says: 'Share presets, bridge cartridges, and sector layouts.' },
  { id: 'settings', label: 'Diagnostics & Settings', says: 'Fidelity stages, Bayer dither, raw input, audio & hardware.' },
];

const RACING_ITEM: MenuItem = { id: 'racing', label: 'Goblin Racing', says: 'Race goblins in glass balls round an island.' };

/** The menu for a version of the game: Goblin Racing remains accessible if specifically requested. */
export function homeMenu(edition: Edition): readonly MenuItem[] {
  return edition === 'goblin-racing' ? [RACING_ITEM, ...FIDELITY_MENU] : FIDELITY_MENU;
}

import { ProfileChip } from './profile-chip';
import { FidelityLogo } from './fidelity-logo';

/**
 * The FIDELITY home: The base game of the SetMix Multiverse.
 * Operates over the Lunar Observation Lab backdrop, presenting the comprehensive
 * mission suite (Expedition [Desynced], Planetary Grid [Synced], Studio, Workshop, Community, Settings)
 * and real-time substrate telemetry.
 */
export function SetMixHome(props: {
  readonly onExpedition?: () => void;
  readonly onGrid?: () => void;
  readonly onFabricator?: () => void;
  readonly onStudio?: () => void;
  readonly onWorkshop?: () => void;
  readonly onCommunity: () => void;
  readonly onSettings: () => void;
  readonly credits: number;
  // Compatibility props:
  readonly onPlay?: () => void;
  readonly onGoblin?: () => void;
  readonly onMyIsland?: () => void;
  readonly onAvatars?: () => void;
  readonly onIslandNow?: () => void;
  readonly island?: { readonly name: string; readonly visited: boolean } | null;
  readonly leader?: { readonly line: Ref<SVGLineElement>; readonly ring: Ref<SVGCircleElement> };
  readonly onManageProfiles?: () => void;
  readonly onSwitching?: (name: string) => void;
}): ReactElement {
  const act: Record<MenuId, (() => void) | undefined> = {
    expedition: props.onExpedition ?? props.onPlay,
    play: props.onPlay,
    grid: props.onGrid ?? props.onPlay,
    island: props.onMyIsland,
    fabricator: props.onFabricator,
    studio: props.onStudio,
    workshop: props.onWorkshop,
    community: props.onCommunity,
    settings: props.onSettings,
    racing: props.onGoblin,
    avatars: props.onAvatars,
  };

  return (
    <div className="sm-home lab fidelity-home">
      {props.leader ? (
        <svg className="sm-leader" aria-hidden="true"><circle ref={props.leader.ring} r="0" /><line ref={props.leader.line} /></svg>
      ) : null}

      {/* Brand Header */}
      <div className="sm-brand fidelity-brand">
        <div className="fidelity-brand-lockup">
          <FidelityLogo size={58} glow />
          <div className="fidelity-brand-text">
            <b>FIDELITY</b>
            <i>A SetMix System // Substrate Research Initiative</i>
          </div>
        </div>
      </div>

      {/* Primary Navigation Suite */}
      <nav className="sm-menu fidelity-menu" aria-label="FIDELITY Operations">
        {homeMenu(EDITION).map((m, i) => (
          <Fragment key={m.id}>
            <button
              style={{ ['--i' as string]: i }}
              onClick={act[m.id]}
              disabled={!act[m.id]}
              className={m.badge ? 'has-badge' : ''}
            >
              <div className="sm-menu-label-row">
                <b>{m.label}</b>
                {m.badge ? <span className="fidelity-badge">{m.badge}</span> : null}
              </div>
              <small>{m.says}</small>
            </button>
          </Fragment>
        ))}
      </nav>

      {/* Live Substrate Telemetry HUD (Right Observation Panel) */}
      <aside className="fidelity-telemetry-hud" aria-label="Substrate Telemetry">
        <div className="hud-panel-header">
          <span className="hud-indicator-dot pulsing" />
          <span>SUBSTRATE TELEMETRY</span>
        </div>

        <div className="hud-tile">
          <div className="hud-tile-title">CONTAINMENT INTEGRITY</div>
          <div className="hud-tile-value cyan">98.4%</div>
          <div className="hud-meter-track">
            <div className="hud-meter-bar" style={{ width: '98.4%' }} />
          </div>
          <div className="hud-tile-sub">SUBSTRATE DRIFT: NOMINAL</div>
        </div>

        <div className="hud-tile">
          <div className="hud-tile-title">ACTIVE RESOLUTION VECTOR</div>
          <div className="hud-vector-grid">
            <span title="Pixel Density">Pxd: <b>1.00</b></span>
            <span title="Vertex Tessellation">Vtx: <b>1.00</b></span>
            <span title="Lux / Shading">Lx: <b>1.00</b></span>
            <span title="Acoustics">Aq: <b>1.00</b></span>
          </div>
          <div className="hud-tile-sub">S = (Pxd, Vtx, Lx, Aq)</div>
        </div>

        <div className="hud-tile">
          <div className="hud-tile-title">WEEKLY PROTOCOL</div>
          <div className="hud-tile-value amber">CYCLE 42</div>
          <div className="hud-tile-sub">COMMUNITY CONSENSUS ACTIVE</div>
        </div>

        <div className="hud-tile">
          <div className="hud-tile-title">LUNAR PORTAL</div>
          <div className="hud-badge-online">GATE SHIELDED // READY</div>
        </div>
      </aside>

      {/* Top Controls */}
      <div className="sm-top-controls">
        <ProfileChip onManageProfiles={props.onManageProfiles ?? (() => {})} onSwitching={props.onSwitching} />
        <span className="sm-credits" title="In-game credits. Never real money.">{props.credits} cr</span>
      </div>
    </div>
  );
}
