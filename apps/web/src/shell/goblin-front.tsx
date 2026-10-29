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
  | 'community'
  | 'settings'
  | 'racing'
  | 'play'
  | 'island'
  | 'avatars'
  | 'credits';

export interface MenuItem {
  readonly id: MenuId;
  readonly label: string;
  readonly says: string;
  readonly badge?: string;
}

const FIDELITY_MENU: readonly MenuItem[] = [
  { id: 'expedition', label: 'Expedition', says: 'Play solo and offline: you arrive on a world at stage 3, your drone at your side.', badge: 'DESYNCED' },
  { id: 'grid', label: 'Planetary Grid', says: 'Multiplayer (synced): a shared 40,000 km world, merged by majority rule.', badge: 'SYNCED' },
  { id: 'studio', label: 'The Studio', says: 'In-engine world & schema editor. Terrain sculpting, machine placement & test drive.', badge: 'EDITOR' },
  { id: 'community', label: 'Community Nexus', says: 'Share presets, bridge cartridges, and sector layouts.' },
  { id: 'settings', label: 'Diagnostics & Settings', says: 'Fidelity stages, Bayer dither, raw input, audio & hardware.' },
  { id: 'credits', label: 'Ending Credits', says: 'Real-time in-engine music video: "Four Floats" (v4b @ 144 BPM).', badge: '144 BPM' },
];

const RACING_ITEM: MenuItem = { id: 'racing', label: 'Goblin Racing', says: 'Race goblins in glass balls round an island.' };

import { UI_STYLE_SHELF, getUiStylePreset, type UiStyleId } from '@hm/hudlayout';
import { ProfileChip } from './profile-chip';
import { FidelityLogo } from './fidelity-logo';

/** The menu for a version of the game: Goblin Racing remains accessible if specifically requested. */
export function homeMenu(edition: Edition, endingSeen = false): readonly MenuItem[] {
  const base = endingSeen ? FIDELITY_MENU : FIDELITY_MENU.filter((m) => m.id !== 'credits');
  return edition === 'goblin-racing' ? [RACING_ITEM, ...base] : base;
}

/**
 * Plan 58: The FIDELITY Home Holo-Deck Menu, driven by Rung-1 `UiStylePreset` tokens (`UI_STYLE_SHELF`)
 * with live hover try-on (`previews-drive-play`).
 */
export function SetMixHome(props: {
  readonly onExpedition?: () => void;
  readonly onGrid?: () => void;
  readonly onFabricator?: () => void;
  readonly onStudio?: () => void;
  readonly onCommunity: () => void;
  readonly onSettings: () => void;
  /** The title's Ending Credits item: the video plays in the play screen (TICKET-14). */
  readonly onCredits?: () => void;
  readonly endingSeen?: boolean;
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
  /** Plan 58: Active and hovered UI Style preset IDs (`UI_STYLE_SHELF`). */
  readonly uiStyleId?: UiStyleId;
  readonly onSelectUiStyle?: (id: UiStyleId) => void;
  readonly onHoverUiStyle?: (id: UiStyleId | null) => void;
}): ReactElement {
  const activeStyle = getUiStylePreset(props.uiStyleId);

  const act: Record<MenuId, (() => void) | undefined> = {
    expedition: props.onExpedition ?? props.onPlay,
    play: props.onPlay,
    grid: props.onGrid ?? props.onPlay,
    island: props.onMyIsland,
    fabricator: props.onFabricator,
    studio: props.onStudio,
    community: props.onCommunity,
    settings: props.onSettings,
    credits: props.onCredits,
    racing: props.onGoblin,
    avatars: props.onAvatars,
  };

  return (
    <div className="sm-home lab fidelity-home" data-ui-style={activeStyle.id}>
      {props.leader ? (
        <svg className="sm-leader" aria-hidden="true"><circle ref={props.leader.ring} r="0" /><line ref={props.leader.line} /></svg>
      ) : null}

      {/* Plan 58: Preset-driven Holo-Deck Navigation Blade styled via `--ui-*` tokens from `UI_STYLE_SHELF` */}
      <div
        className="fidelity-glass-blade"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 'min(440px, 86vw)',
          zIndex: 2,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          background: 'var(--ui-paper, rgba(8, 12, 20, 0.84))',
          color: 'var(--ui-ink, #f1f5f9)',
          fontFamily: 'var(--ui-font, inherit)',
          borderRight: '1px solid var(--ui-accent, rgba(167, 139, 250, 0.35))',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Brand Header */}
        <div className="sm-brand fidelity-brand">
          <div className="fidelity-brand-lockup">
            <FidelityLogo size={58} glow />
            <div className="fidelity-brand-text">
              <b style={{ color: 'var(--ui-ink, #f1f5f9)' }}>FIDELITY</b>
              <i style={{ color: 'var(--ui-dim, #94a3b8)' }}>Seeded Worlds // LitRPG &amp; Co-Creation Sandbox</i>
            </div>
          </div>
        </div>

        {/* Primary Navigation Suite */}
        <nav className="sm-menu fidelity-menu" aria-label="FIDELITY Operations">
          {homeMenu(EDITION, props.endingSeen).map((m, i) => (
            <Fragment key={m.id}>
              <button
                style={{
                  ['--i' as string]: i,
                  borderRadius: 'var(--ui-radius, 6px)',
                  borderColor: 'var(--ui-accent, rgba(167, 139, 250, 0.28))',
                  color: 'var(--ui-ink, #f1f5f9)',
                }}
                onClick={act[m.id]}
                disabled={!act[m.id]}
                className={m.badge ? 'has-badge' : ''}
              >
                <div className="sm-menu-label-row">
                  <b>{m.label}</b>
                  {m.badge ? <span className="fidelity-badge">{m.badge}</span> : null}
                </div>
                <small style={{ color: 'var(--ui-dim, #94a3b8)' }}>{m.says}</small>
              </button>
            </Fragment>
          ))}
        </nav>

        {/* Plan 58: Live UI Style Preset Switcher (Hover Try-On + 1-Click Apply) */}
        {props.onSelectUiStyle ? (
          <div
            className="fidelity-ui-style-bar"
            aria-label="Interface Style Presets"
            style={{
              marginTop: 'auto',
              paddingTop: 10,
              borderTop: '1px solid rgba(148, 163, 184, 0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ui-dim, #94a3b8)' }}>
              <span>UI STYLE PRESET</span>
              <b style={{ color: 'var(--ui-accent, #a78bfa)' }}>{activeStyle.name}</b>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {UI_STYLE_SHELF.map((st) => {
                const isCurrent = st.id === activeStyle.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onMouseEnter={() => props.onHoverUiStyle?.(st.id)}
                    onMouseLeave={() => props.onHoverUiStyle?.(null)}
                    onFocus={() => props.onHoverUiStyle?.(st.id)}
                    onBlur={() => props.onHoverUiStyle?.(null)}
                    onClick={() => props.onSelectUiStyle?.(st.id)}
                    title={`${st.name}: ${st.tagline}`}
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      borderRadius: 'var(--ui-radius, 4px)',
                      border: `1px solid ${isCurrent ? st.tokens.accent : 'rgba(148,163,184,0.25)'}`,
                      background: isCurrent ? st.tokens.paper : 'rgba(15, 23, 42, 0.55)',
                      color: isCurrent ? st.tokens.accent : st.tokens.ink,
                      cursor: 'pointer',
                    }}
                  >
                    {st.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>


      {/* plan 57 §4, §10: the right side is left clear for the room's bridge screen. The old telemetry column showed fixed
          numbers and story copy; it comes back as the System HUD, reading real state (a lens, never a lie) */}

      {/* Top Controls */}
      <div className="sm-top-controls">
        <ProfileChip onManageProfiles={props.onManageProfiles ?? (() => {})} onSwitching={props.onSwitching} />
        <span className="sm-credits" title="In-game credits. Never real money.">{props.credits} cr</span>
      </div>
    </div>
  );
}
