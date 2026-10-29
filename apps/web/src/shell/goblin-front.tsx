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

import {
  HOME_HOLODECK_SCREEN,
  UI_STYLE_SHELF,
  decodeScreen,
  getUiStylePreset,
  type UiScreen,
  type UiStyleId,
} from '@hm/hudlayout';
import { kv } from '../storage/profile-storage';
import { ProfileChip } from './profile-chip';
import { FidelityLogo } from './fidelity-logo';

export const UI_HOME_SCREEN_KEY = 'hm.setmix.ui.homeScreen';

/** Reads the Studio-authored Home Screen preset (`uic:` code in kv) or returns `HOME_HOLODECK_SCREEN`. */
export function loadHomeScreenPreset(): UiScreen {
  try {
    const raw = kv.get(UI_HOME_SCREEN_KEY);
    if (raw) {
      const decoded = decodeScreen(raw);
      if (decoded && decoded.id === 'home-holodeck') return decoded;
    }
  } catch {
    /* fallback to default */
  }
  return HOME_HOLODECK_SCREEN;
}

/** The menu for a version of the game: Goblin Racing remains accessible if specifically requested. */
export function homeMenu(edition: Edition, endingSeen = false): readonly MenuItem[] {
  const base = endingSeen ? FIDELITY_MENU : FIDELITY_MENU.filter((m) => m.id !== 'credits');
  return edition === 'goblin-racing' ? [RACING_ITEM, ...base] : base;
}

const MENU_ID_TO_PART_ID: Partial<Record<MenuId, string>> = {
  expedition: 'act-expedition',
  grid: 'act-grid',
  studio: 'act-studio',
  community: 'act-community',
  settings: 'act-settings',
};

/**
 * Plan 58: The FIDELITY Home Menu Chassis, built from the Rung-4 `HOME_HOLODECK_SCREEN` (`ui:`) preset
 * and Rung-1 `UiStylePreset` tokens (`UI_STYLE_SHELF`, defaulting to `braun-atelier`) with live hover try-on.
 */
export function SetMixHome(props: {
  readonly onExpedition?: () => void;
  readonly onGrid?: () => void;
  readonly onFabricator?: () => void;
  readonly onStudio?: () => void;
  readonly onOpenUiStudio?: () => void;
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
  const homeScreen = loadHomeScreenPreset();
  const navPanel = homeScreen.panels.find((p) => p.id === 'home-nav');
  const profilePanel = homeScreen.panels.find((p) => p.id === 'home-profile');

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

      {/* Plan 58: Tactile Industrial Left Faceplate (`HOME_HOLODECK_SCREEN` + `UI_STYLE_SHELF`) */}
      <div
        className="fidelity-glass-blade"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 'min(410px, 86vw)',
          zIndex: 2,
          background: 'var(--ui-panel, #1b1d19)',
          color: 'var(--ui-ink, #f2f0e8)',
          fontFamily: 'var(--ui-font, Inter, sans-serif)',
          borderRight: '1px solid var(--ui-line, #4c4f47)',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflowY: 'auto',
        }}
      >
        {/* Brand Header (Static Flow inside Chassis — never overlaps modals or nav) */}
        <div
          className="sm-brand fidelity-brand"
          style={{
            position: 'static',
            paddingBottom: 14,
            borderBottom: '1px solid var(--ui-line, #4c4f47)',
            animation: 'none',
          }}
        >
          <div className="fidelity-brand-lockup">
            <FidelityLogo size={44} />
            <div className="fidelity-brand-text">
              <b style={{ color: 'var(--ui-ink, #f2f0e8)' }}>FIDELITY</b>
              <i style={{ color: 'var(--ui-dim, #9e9c92)' }}>Seeded Worlds // Co-Creation System</i>
            </div>
          </div>
        </div>

        {/* Primary Navigation Suite (`home-nav` panel from `HOME_HOLODECK_SCREEN`) */}
        {navPanel?.visible !== false ? (
          <nav
            className="sm-menu fidelity-menu"
            aria-label="FIDELITY Operations"
            style={{
              position: 'static',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {homeMenu(EDITION, props.endingSeen).map((m, i) => {
              const partId = MENU_ID_TO_PART_ID[m.id];
              const presetPart = navPanel?.parts.find((pt) => pt.id === partId);
              const isPrimary = i === 0;
              return (
                <Fragment key={m.id}>
                  <button
                    style={{
                      ['--i' as string]: i,
                      padding: '11px 13px',
                      borderRadius: 'var(--ui-radius, 2px)',
                      border: `1px solid ${isPrimary ? 'var(--ui-accent, #d96b43)' : 'var(--ui-line, #4c4f47)'}`,
                      borderLeft: `3px solid ${isPrimary ? 'var(--ui-accent, #d96b43)' : 'var(--ui-line, #4c4f47)'}`,
                      background: 'var(--ui-inset, #2a2c27)',
                      color: 'var(--ui-ink, #f2f0e8)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      textAlign: 'left',
                      animation: 'none',
                    }}
                    onClick={act[m.id]}
                    disabled={!act[m.id]}
                    className={m.badge ? 'has-badge' : ''}
                  >
                    <div className="sm-menu-label-row">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontFamily: 'ui-monospace, Consolas, monospace',
                            fontSize: 10,
                            fontWeight: 700,
                            color: isPrimary ? 'var(--ui-accent, #d96b43)' : 'var(--ui-dim, #9e9c92)',
                          }}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <b style={{ fontSize: 16, fontWeight: 700, color: 'var(--ui-ink, #f2f0e8)' }}>
                          {presetPart && m.id === 'expedition' ? `${m.label}` : m.label}
                        </b>
                      </span>
                      {m.badge ? <span className="fidelity-badge">{m.badge}</span> : null}
                    </div>
                    <small style={{ color: 'var(--ui-dim, #9e9c92)', fontSize: 12, lineHeight: 1.35 }}>
                      {m.says}
                    </small>
                  </button>
                </Fragment>
              );
            })}
          </nav>
        ) : null}

        {/* Plan 58: Tactile UI Style Preset Switcher (Hover Try-On + Direct Studio UI Editor Link) */}
        {props.onSelectUiStyle ? (
          <div
            className="fidelity-ui-style-bar"
            aria-label="Interface Style Presets"
            style={{
              marginTop: 'auto',
              paddingTop: 12,
              borderTop: '1px solid var(--ui-line, #4c4f47)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--ui-dim, #9e9c92)' }}>
              <span style={{ fontFamily: 'ui-monospace, Consolas, monospace', letterSpacing: '0.06em' }}>
                UI PRESET // {activeStyle.id.toUpperCase()}
              </span>
              <b style={{ color: 'var(--ui-accent, #d96b43)' }}>{activeStyle.name}</b>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
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
                      padding: '5px 7px',
                      fontSize: 11,
                      fontWeight: isCurrent ? 700 : 500,
                      borderRadius: 'var(--ui-radius, 2px)',
                      border: `1px solid ${isCurrent ? 'var(--ui-accent, #d96b43)' : 'var(--ui-line, #4c4f47)'}`,
                      background: isCurrent ? 'var(--ui-accent, #d96b43)' : 'var(--ui-inset, #2a2c27)',
                      color: isCurrent ? 'var(--ui-accent-ink, #ffffff)' : 'var(--ui-ink, #f2f0e8)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: isCurrent ? st.tokens.paper : st.tokens.accent,
                        border: '1px solid rgba(0,0,0,0.25)',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {st.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
            {props.onOpenUiStudio ? (
              <button
                type="button"
                onClick={props.onOpenUiStudio}
                data-testid="open-ui-studio-btn"
                style={{
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 'var(--ui-radius, 2px)',
                  border: '1px solid var(--ui-line, #4c4f47)',
                  background: 'var(--ui-panel, #1b1d19)',
                  color: 'var(--ui-dim, #9e9c92)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Customize UI Presets &amp; Screens in Studio →
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Top Controls (`home-profile` panel from `HOME_HOLODECK_SCREEN`) */}
      {profilePanel?.visible !== false ? (
        <div className="sm-top-controls">
          <ProfileChip onManageProfiles={props.onManageProfiles ?? (() => {})} onSwitching={props.onSwitching} />
          <span className="sm-credits" title="In-game credits. Never real money.">{props.credits} cr</span>
        </div>
      ) : null}
    </div>
  );
}
