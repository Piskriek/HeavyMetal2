import React, { useMemo, useState } from 'react';
import {
  APPRAISE_COMMANDS,
  APPRAISE_LENS_SCREEN,
  APPRAISE_SOURCES,
  UI_ANCHORS as ANCHORS,
  UI_FONTS as FONTS,
  WIDGET_FRAMES as FRAMES,
  HOME_HOLODECK_COMMANDS,
  HOME_HOLODECK_SCREEN,
  HOME_HOLODECK_SOURCES,
  META_SHELL_COMMANDS,
  META_SHELL_SCREEN,
  META_SHELL_SOURCES,
  STUDIO_SHELL_COMMANDS,
  STUDIO_SHELL_SCREEN,
  STUDIO_SHELL_SOURCES,
  WIDGET_TONES as TONES,
  UI_STYLE_SHELF,
  WIDGET_KINDS as WIDGETS,
  applyUiStylePreset,
  decodeScreen,
  encodeScreen,
  getUiStylePreset,
  uiTokensToCssVars,
  validateScreen,
  type Anchor as UiAnchor,
  type UiCommand,
  type UiFont,
  type WidgetFrame as UiFrame,
  type UiPanel,
  type UiPart,
  type UiScreen,
  type UiSource,
  type UiStyleId,
  type WidgetTone as UiTone,
  type WidgetKind as UiWidgetKind,
} from '@hm/hudlayout';
import { PLAY_HUD_COMMANDS, PLAY_HUD_SCREEN, PLAY_HUD_SOURCES } from '../../play/ui-play-hud';
import { HarvestedShelfAndAppraiseDeck } from '../../play/ui-appraise-lens';
import { kv } from '../../storage/profile-storage';

export type EditableScreenId = 'home-holodeck' | 'play-hud' | 'meta-shell' | 'studio-shell' | 'appraise-lens';

interface ScreenPresetCatalogEntry {
  readonly id: EditableScreenId;
  readonly label: string;
  readonly storageKey: string;
  readonly defaultScreen: UiScreen;
  readonly sources: readonly UiSource[];
  readonly commands: readonly UiCommand[];
  readonly sampleValues: Readonly<Record<string, string | number>>;
}

const SCREEN_CATALOG: readonly ScreenPresetCatalogEntry[] = [
  {
    id: 'home-holodeck',
    label: 'Home Menu (ui:home-holodeck)',
    storageKey: 'hm.setmix.ui.homeScreen',
    defaultScreen: HOME_HOLODECK_SCREEN,
    sources: HOME_HOLODECK_SOURCES,
    commands: HOME_HOLODECK_COMMANDS,
    sampleValues: {
      'room.stage': 'S3',
      'room.warmShare': 1,
      'profile.name': 'Isikai',
      'profile.credits': 500,
      'ui.styleName': 'Braun Atelier',
      'bridge.status': 'Bridge ready (15 fps)',
    },
  },
  {
    id: 'play-hud',
    label: 'Play HUD (ui:play-hud)',
    storageKey: 'hm.setmix.ui.playScreen',
    defaultScreen: PLAY_HUD_SCREEN,
    sources: PLAY_HUD_SOURCES,
    commands: PLAY_HUD_COMMANDS,
    sampleValues: {
      'goal.title': 'Stage 3 — Gouraud Arrival',
      'goal.hint': 'Survey the seeded basin and power the plinth',
      'goal.next': 'Stage 4 PBR',
      'plot.stage': 'S3',
      'floats.pxd': 68,
      'floats.vtx': 64,
      'floats.lx': 72,
      'floats.aq': 45,
      'plot.ore': 120,
      'power.demand': 18,
      'player.hp': 95,
      'system.notice': '[SYSTEM] Skill acquired: Harmonic Appraisal',
    },
  },
  {
    id: 'meta-shell',
    label: 'Wanderer Meta-Shell (ui:meta-shell)',
    storageKey: 'hm.setmix.ui.metaScreen',
    defaultScreen: META_SHELL_SCREEN,
    sources: META_SHELL_SOURCES,
    commands: META_SHELL_COMMANDS,
    sampleValues: {
      'wanderer.bal': 0.94,
      'wanderer.calm': 0.3,
      'party.doubling': 4,
      'guild.coherence': 0.96,
      'comms.messages': '3 callouts',
      'clip.status': 'hm2:clip:v1 ready',
      'harness.bridgeMode': 'mirror-only',
    },
  },
  {
    id: 'studio-shell',
    label: 'Studio Chrome (ui:studio-shell)',
    storageKey: 'hm.setmix.ui.studioScreen',
    defaultScreen: STUDIO_SHELL_SCREEN,
    sources: STUDIO_SHELL_SOURCES,
    commands: STUDIO_SHELL_COMMANDS,
    sampleValues: {
      'studio.worldName': 'Seeded World Alpha',
      'studio.rung': 4,
      'studio.workspace': 'Creative Suite',
      'studio.uiStyle': 'Braun Atelier',
      'studio.stagedCount': 2,
    },
  },
  {
    id: 'appraise-lens',
    label: 'Appraisal Lens (ui:appraise-panel)',
    storageKey: 'hm.setmix.ui.appraiseScreen',
    defaultScreen: APPRAISE_LENS_SCREEN,
    sources: APPRAISE_SOURCES,
    commands: APPRAISE_COMMANDS,
    sampleValues: {
      'appraise.name': 'SmallBlockSmallThrust (kit:e912a401)',
      'appraise.kind': 'Rung 4 · thruster-propulsion',
      'appraise.author': 'Transduced · Space Engineers',
      'appraise.pxd': 72,
      'appraise.vtx': 64,
      'appraise.lx': 88,
      'appraise.aq': 45,
      'appraise.massKg': 50,
      'appraise.thrustKn': 14.4,
      'appraise.powerMW': 0.2,
      'appraise.ports': '5 attachment sockets',
      'appraise.archetype': 'Mind: The Magician (#1) · Body: The Hermit (#9)',
      'appraise.polarity': 'Masculine (pol=64)',
      'appraise.balance': 0.96,
      'appraise.bodyZone': 'All 7 rays flowing cleanly.',
    },
  },
];

function loadSavedScreen(entry: ScreenPresetCatalogEntry): UiScreen {
  try {
    const raw = kv.get(entry.storageKey);
    if (raw) {
      const decoded = decodeScreen(raw);
      if (decoded && decoded.id === entry.id) return decoded;
    }
  } catch {
    /* ignore */
  }
  return entry.defaultScreen;
}

const ANCHOR_GRID_POS: Readonly<Record<UiAnchor, { readonly col: number; readonly row: number; readonly align: string }>> = {
  'top-left': { col: 1, row: 1, align: 'flex-start' },
  'top-center': { col: 2, row: 1, align: 'center' },
  'top-right': { col: 3, row: 1, align: 'flex-end' },
  'middle-left': { col: 1, row: 2, align: 'flex-start' },
  'center': { col: 2, row: 2, align: 'center' },
  'middle-right': { col: 3, row: 2, align: 'flex-end' },
  'bottom-left': { col: 1, row: 3, align: 'flex-start' },
  'bottom-center': { col: 2, row: 3, align: 'center' },
  'bottom-right': { col: 3, row: 3, align: 'flex-end' },
};

/** Detects two visible panels anchored to the same 9-zone slot with overlapping offset boxes (`UI_EDITOR_RESEARCH.md` P5). */
export function detectOverlappingPanels(panels: readonly UiPanel[]): readonly string[] {
  const visible = panels.filter((p) => p.visible);
  const overlaps: string[] = [];
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i]!;
      const b = visible[j]!;
      if (a.anchor === b.anchor && Math.abs(a.offsetX - b.offsetX) < 120 && Math.abs(a.offsetY - b.offsetY) < 48) {
        overlaps.push(`${a.id} ↔ ${b.id} (${a.anchor})`);
      }
    }
  }
  return overlaps;
}

export interface UiPresetInspectorProps {
  readonly activeStyleId: UiStyleId;
  readonly onSelectStyleId: (id: UiStyleId) => void;
  readonly onHoverStyleId: (id: UiStyleId | null) => void;
}

export const UiPresetInspector: React.FC<UiPresetInspectorProps> = ({
  activeStyleId,
  onSelectStyleId,
  onHoverStyleId,
}) => {
  const [selectedScreenId, setSelectedScreenId] = useState<EditableScreenId>('home-holodeck');
  const catalogEntry = useMemo(
    () => SCREEN_CATALOG.find((c) => c.id === selectedScreenId) ?? SCREEN_CATALOG[0]!,
    [selectedScreenId],
  );

  const [screensById, setScreensById] = useState<Record<EditableScreenId, UiScreen>>(() => ({
    'home-holodeck': loadSavedScreen(SCREEN_CATALOG[0]!),
    'play-hud': loadSavedScreen(SCREEN_CATALOG[1]!),
    'meta-shell': loadSavedScreen(SCREEN_CATALOG[2]!),
    'studio-shell': loadSavedScreen(SCREEN_CATALOG[3]!),
    'appraise-lens': loadSavedScreen(SCREEN_CATALOG[4]!),
  }));

  const [hoverPartTone, setHoverPartTone] = useState<{ panelId: string; partId: string; tone: UiTone } | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeFeedback, setCodeFeedback] = useState<string | null>(null);

  const rawScreen = screensById[selectedScreenId];
  const activeStyle = getUiStylePreset(activeStyleId);

  // Apply hover preview on part tone if hovered
  const previewScreen: UiScreen = useMemo(() => {
    if (!hoverPartTone) return rawScreen;
    return {
      ...rawScreen,
      panels: rawScreen.panels.map((p) =>
        p.id !== hoverPartTone.panelId
          ? p
          : {
              ...p,
              parts: p.parts.map((pt) =>
                pt.id !== hoverPartTone.partId
                  ? pt
                  : { ...pt, look: { ...pt.look, tone: hoverPartTone.tone } },
              ),
            },
      ),
    };
  }, [rawScreen, hoverPartTone]);

  const updateActiveScreen = (next: UiScreen) => {
    setScreensById((prev) => ({ ...prev, [selectedScreenId]: next }));
    const issues = validateScreen(next, catalogEntry.sources, catalogEntry.commands);
    if (issues.length === 0) {
      try {
        kv.set(catalogEntry.storageKey, encodeScreen(next));
      } catch {
        /* ignore */
      }
    }
  };

  const handleStylePick = (id: UiStyleId) => {
    onSelectStyleId(id);
    const updated = applyUiStylePreset(rawScreen, id);
    updateActiveScreen(updated);
  };

  const issues = useMemo(
    () => validateScreen(previewScreen, catalogEntry.sources, catalogEntry.commands),
    [previewScreen, catalogEntry],
  );
  const overlaps = useMemo(() => detectOverlappingPanels(previewScreen.panels), [previewScreen.panels]);
  const shareCode = useMemo(() => encodeScreen(rawScreen), [rawScreen]);
  const previewVars = useMemo(() => uiTokensToCssVars(previewScreen.tokens), [previewScreen.tokens]);

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(shareCode);
    }
    setCodeFeedback('Copied uic: share code to clipboard.');
    setTimeout(() => setCodeFeedback(null), 2500);
  };

  const handleImportCode = () => {
    const trimmed = codeInput.trim();
    if (!trimmed) return;
    const decoded = decodeScreen(trimmed);
    if (!decoded) {
      setCodeFeedback('Refused: invalid or damaged uic: share code.');
      return;
    }
    const check = validateScreen(decoded, catalogEntry.sources, catalogEntry.commands);
    if (check.length > 0) {
      setCodeFeedback(`Refused by Lens Rule: ${check.map((i) => `${i.code} (${i.at})`).join(', ')}`);
      return;
    }
    updateActiveScreen({ ...decoded, id: selectedScreenId });
    setCodeInput('');
    setCodeFeedback('Imported and validated uic: screen preset.');
  };

  const handleResetScreen = () => {
    const fresh = applyUiStylePreset(catalogEntry.defaultScreen, activeStyleId);
    updateActiveScreen(fresh);
    setCodeFeedback('Reset screen to default Studio preset.');
  };

  return (
    <div
      data-testid="ui-preset-inspector"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        color: 'var(--ui-ink, #f2f0e8)',
        fontFamily: 'var(--ui-font, Inter, sans-serif)',
        fontSize: 12,
      }}
    >
      {/* Rung 1: Tactile Industrial Style Shelf (`UI_STYLE_SHELF`) */}
      <section
        style={{
          padding: 12,
          background: 'var(--ui-inset, #2a2c27)',
          border: '1px solid var(--ui-line, #4c4f47)',
          borderRadius: 'var(--ui-radius, 2px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Rung 1 // Tactile UI Style Shelf (Hover Try-On)
          </b>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--ui-accent, #d96b43)' }}>
            {activeStyle.name}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {UI_STYLE_SHELF.map((st) => {
            const isSel = st.id === activeStyleId;
            return (
              <button
                key={st.id}
                type="button"
                data-testid={`studio-ui-style-${st.id}`}
                onMouseEnter={() => onHoverStyleId(st.id)}
                onMouseLeave={() => onHoverStyleId(null)}
                onFocus={() => onHoverStyleId(st.id)}
                onBlur={() => onHoverStyleId(null)}
                onClick={() => handleStylePick(st.id)}
                style={{
                  padding: '8px 10px',
                  textAlign: 'left',
                  borderRadius: 'var(--ui-radius, 2px)',
                  border: `1px solid ${isSel ? 'var(--ui-accent, #d96b43)' : 'var(--ui-line, #4c4f47)'}`,
                  borderLeft: `3px solid ${st.tokens.accent}`,
                  background: isSel ? 'var(--ui-panel, #1b1d19)' : 'transparent',
                  color: 'var(--ui-ink, #f2f0e8)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 12 }}>{st.name}</b>
                  <span style={{ display: 'inline-flex', gap: 3 }}>
                    <i style={{ width: 8, height: 8, background: st.tokens.paper, border: '1px solid #666', display: 'inline-block' }} />
                    <i style={{ width: 8, height: 8, background: st.tokens.ink, display: 'inline-block' }} />
                    <i style={{ width: 8, height: 8, background: st.tokens.accent, display: 'inline-block' }} />
                  </span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--ui-dim, #9e9c92)', lineHeight: 1.25 }}>
                  {st.tagline}
                </span>
              </button>
            );
          })}
        </div>

        {/* Direct Token Fine-Tuning (Paper, Ink, Accent, Radius, Font) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 6,
            paddingTop: 8,
            borderTop: '1px solid var(--ui-line, #4c4f47)',
            alignItems: 'center',
          }}
        >
          {(
            [
              ['paper', 'Panel'],
              ['ink', 'Ink'],
              ['accent', 'Accent'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10 }}>
              <span style={{ color: 'var(--ui-dim, #9e9c92)' }}>{label}</span>
              <input
                type="color"
                value={rawScreen.tokens[key]}
                onChange={(e) =>
                  updateActiveScreen({
                    ...rawScreen,
                    tokens: { ...rawScreen.tokens, [key]: e.target.value },
                  })
                }
                style={{ width: '100%', height: 24, padding: 0, cursor: 'pointer' }}
              />
            </label>
          ))}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10 }}>
            <span style={{ color: 'var(--ui-dim, #9e9c92)' }}>Radius ({rawScreen.tokens.radius}px)</span>
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              value={rawScreen.tokens.radius}
              onChange={(e) =>
                updateActiveScreen({
                  ...rawScreen,
                  tokens: { ...rawScreen.tokens, radius: Number(e.target.value) },
                })
              }
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10 }}>
            <span style={{ color: 'var(--ui-dim, #9e9c92)' }}>Font</span>
            <select
              value={rawScreen.tokens.font}
              onChange={(e) =>
                updateActiveScreen({
                  ...rawScreen,
                  tokens: { ...rawScreen.tokens, font: e.target.value as UiFont },
                })
              }
              style={{ fontSize: 11, padding: '3px 4px' }}
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Rung 4: Screen Preset Selector */}
      <section
        style={{
          padding: 12,
          background: 'var(--ui-inset, #2a2c27)',
          border: '1px solid var(--ui-line, #4c4f47)',
          borderRadius: 'var(--ui-radius, 2px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Rung 4 // Target Screen Preset
          </b>
          <span
            data-testid="ui-lens-status"
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 'var(--ui-radius, 2px)',
              background: issues.length === 0 && overlaps.length === 0 ? 'var(--ui-ok, #5c9a78)' : 'var(--ui-danger, #c94a38)',
              color: '#ffffff',
              fontWeight: 700,
            }}
          >
            {issues.length === 0 && overlaps.length === 0
              ? 'LENS RULE & 9-ZONE GATE: PASS'
              : `${issues.length} ISSUE(S) / ${overlaps.length} OVERLAP(S)`}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5 }}>
          {SCREEN_CATALOG.map((sc) => {
            const active = sc.id === selectedScreenId;
            return (
              <button
                key={sc.id}
                type="button"
                data-testid={`select-screen-${sc.id}`}
                onClick={() => setSelectedScreenId(sc.id)}
                style={{
                  padding: '6px 8px',
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  textAlign: 'left',
                  borderRadius: 'var(--ui-radius, 2px)',
                  border: `1px solid ${active ? 'var(--ui-accent, #d96b43)' : 'var(--ui-line, #4c4f47)'}`,
                  background: active ? 'var(--ui-accent, #d96b43)' : 'var(--ui-panel, #1b1d19)',
                  color: active ? 'var(--ui-accent-ink, #ffffff)' : 'var(--ui-ink, #f2f0e8)',
                  cursor: 'pointer',
                }}
              >
                {sc.label}
              </button>
            );
          })}
        </div>

        {/* Live 9-Zone Screen Preview (`UI_EDITOR_RESEARCH.md` P1 & P5) */}
        <div
          data-testid="ui-live-screen-preview"
          style={{
            ...(previewVars as React.CSSProperties),
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(3, minmax(54px, auto))',
            gap: 8,
            padding: 10,
            background: 'var(--ui-bg, #141613)',
            border: '1px solid var(--ui-line, #4c4f47)',
            borderRadius: 'var(--ui-radius, 2px)',
            minHeight: 196,
          }}
        >
          {previewScreen.panels
            .filter((p) => p.visible)
            .map((panel) => {
              const pos = ANCHOR_GRID_POS[panel.anchor] ?? ANCHOR_GRID_POS['top-left'] ?? { col: 1, row: 1, align: 'start' as const };
              return (
                <div
                  key={panel.id}
                  style={{
                    gridColumn: pos.col,
                    gridRow: pos.row,
                    justifySelf: pos.align,
                    padding: '6px 8px',
                    background: 'var(--ui-panel, #1b1d19)',
                    border: '1px solid var(--ui-line, #4c4f47)',
                    borderLeft: '2px solid var(--ui-accent, #d96b43)',
                    borderRadius: 'var(--ui-radius, 2px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    width: '100%',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ui-dim)' }}>
                    <b style={{ textTransform: 'uppercase' }}>{panel.id}</b>
                    <span>{panel.anchor}</span>
                  </div>
                  {panel.parts.slice(0, 4).map((pt) => {
                    const toneColor =
                      pt.look.tone === 'accent'
                        ? 'var(--ui-accent)'
                        : pt.look.tone === 'warn'
                          ? 'var(--ui-warn)'
                          : pt.look.tone === 'dim'
                            ? 'var(--ui-dim)'
                            : 'var(--ui-ink)';
                    const sampleVal = catalogEntry.sampleValues[pt.binds];
                    return (
                      <div
                        key={pt.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 6,
                          padding: pt.look.frame === 'none' ? '1px 0' : '2px 5px',
                          background: pt.look.frame === 'fill' ? 'var(--ui-inset)' : 'transparent',
                          border: pt.look.frame === 'line' ? '1px solid var(--ui-line)' : 'none',
                          borderRadius: 'var(--ui-radius, 2px)',
                          fontSize: 10,
                          color: toneColor,
                        }}
                      >
                        <span style={{ fontWeight: pt.look.kind === 'action' ? 700 : 500 }}>{pt.label}</span>
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, opacity: 0.85 }}>
                          {pt.look.kind === 'action' ? '[CMD]' : sampleVal ?? pt.binds}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
        </div>

        {issues.length > 0 || overlaps.length > 0 ? (
          <div style={{ fontSize: 11, color: 'var(--ui-danger, #c94a38)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {issues.map((iss, idx) => (
              <span key={idx}>
                • [{iss.code}] {iss.at}: {iss.detail}
              </span>
            ))}
            {overlaps.map((ov, idx) => (
              <span key={`ov-${idx}`}>• [overlap] Panels overlap in same zone: {ov}</span>
            ))}
          </div>
        ) : null}
      </section>

      {/* Rung 3 & Rung 2: Panels, 8px Grid Offsets & Widget Inspector (`UI_EDITOR_RESEARCH.md` P2 & P4) */}
      <section
        style={{
          padding: 12,
          background: 'var(--ui-inset, #2a2c27)',
          border: '1px solid var(--ui-line, #4c4f47)',
          borderRadius: 'var(--ui-radius, 2px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <b style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Rung 3 &amp; 2 // Panels (9-Zone + 8px Grid) &amp; Widget Parts
        </b>

        {rawScreen.panels.map((panel) => (
          <div
            key={panel.id}
            style={{
              padding: 8,
              background: 'var(--ui-panel, #1b1d19)',
              border: '1px solid var(--ui-line, #4c4f47)',
              borderRadius: 'var(--ui-radius, 2px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={panel.visible}
                  onChange={(e) =>
                    updateActiveScreen({
                      ...rawScreen,
                      panels: rawScreen.panels.map((p) =>
                        p.id === panel.id ? { ...p, visible: e.target.checked } : p,
                      ),
                    })
                  }
                />
                <span>Panel: {panel.id}</span>
              </label>

              <select
                aria-label={`Anchor for ${panel.id}`}
                value={panel.anchor}
                onChange={(e) =>
                  updateActiveScreen({
                    ...rawScreen,
                    panels: rawScreen.panels.map((p) =>
                      p.id === panel.id ? { ...p, anchor: e.target.value as UiAnchor } : p,
                    ),
                  })
                }
                style={{ fontSize: 11, padding: '2px 6px' }}
              >
                {ANCHORS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--ui-dim)' }}>
                <span>dx (8px): {panel.offsetX}</span>
                <input
                  type="range"
                  min={-64}
                  max={160}
                  step={8}
                  value={panel.offsetX}
                  onChange={(e) =>
                    updateActiveScreen({
                      ...rawScreen,
                      panels: rawScreen.panels.map((p) =>
                        p.id === panel.id ? { ...p, offsetX: Number(e.target.value) } : p,
                      ),
                    })
                  }
                  style={{ width: 64 }}
                />
              </label>
            </div>

            {/* Parts inside this panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {panel.parts.map((pt: UiPart) => (
                <div
                  key={pt.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto',
                    gap: 4,
                    alignItems: 'center',
                    paddingTop: 4,
                    borderTop: '1px solid var(--ui-line, #4c4f47)',
                    fontSize: 11,
                  }}
                >
                  <input
                    type="text"
                    value={pt.label}
                    aria-label={`Label for ${pt.id}`}
                    onChange={(e) =>
                      updateActiveScreen({
                        ...rawScreen,
                        panels: rawScreen.panels.map((p) =>
                          p.id !== panel.id
                            ? p
                            : {
                                ...p,
                                parts: p.parts.map((item) =>
                                  item.id === pt.id ? { ...item, label: e.target.value } : item,
                                ),
                              },
                        ),
                      })
                    }
                    style={{ fontSize: 11, padding: '2px 5px', minWidth: 0 }}
                  />
                  <select
                    value={pt.look.kind}
                    aria-label={`Widget kind for ${pt.id}`}
                    onChange={(e) =>
                      updateActiveScreen({
                        ...rawScreen,
                        panels: rawScreen.panels.map((p) =>
                          p.id !== panel.id
                            ? p
                            : {
                                ...p,
                                parts: p.parts.map((item) =>
                                  item.id === pt.id
                                    ? { ...item, look: { ...item.look, kind: e.target.value as UiWidgetKind } }
                                    : item,
                                ),
                              },
                        ),
                      })
                    }
                    style={{ fontSize: 10, padding: '2px 4px' }}
                  >
                    {WIDGETS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                  <select
                    value={pt.look.tone}
                    aria-label={`Tone for ${pt.id}`}
                    onMouseEnter={() =>
                      setHoverPartTone({ panelId: panel.id, partId: pt.id, tone: pt.look.tone })
                    }
                    onMouseLeave={() => setHoverPartTone(null)}
                    onChange={(e) =>
                      updateActiveScreen({
                        ...rawScreen,
                        panels: rawScreen.panels.map((p) =>
                          p.id !== panel.id
                            ? p
                            : {
                                ...p,
                                parts: p.parts.map((item) =>
                                  item.id === pt.id
                                    ? { ...item, look: { ...item.look, tone: e.target.value as UiTone } }
                                    : item,
                                ),
                              },
                        ),
                      })
                    }
                    style={{ fontSize: 10, padding: '2px 4px' }}
                  >
                    {TONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={pt.look.frame}
                    aria-label={`Frame for ${pt.id}`}
                    onChange={(e) =>
                      updateActiveScreen({
                        ...rawScreen,
                        panels: rawScreen.panels.map((p) =>
                          p.id !== panel.id
                            ? p
                            : {
                                ...p,
                                parts: p.parts.map((item) =>
                                  item.id === pt.id
                                    ? { ...item, look: { ...item.look, frame: e.target.value as UiFrame } }
                                    : item,
                                ),
                              },
                        ),
                      })
                    }
                    style={{ fontSize: 10, padding: '2px 4px' }}
                  >
                    {FRAMES.map((fr) => (
                      <option key={fr} value={fr}>
                        {fr}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Rung 4: `uic:` Cartridge Share Code Import / Export (`UI_EDITOR_RESEARCH.md` P6) */}
      <section
        style={{
          padding: 12,
          background: 'var(--ui-inset, #2a2c27)',
          border: '1px solid var(--ui-line, #4c4f47)',
          borderRadius: 'var(--ui-radius, 2px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Cartridge Share Code (uic:)
          </b>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={handleCopyCode} style={{ fontSize: 11, padding: '4px 8px' }}>
              Copy uic:
            </button>
            <button type="button" onClick={handleResetScreen} style={{ fontSize: 11, padding: '4px 8px' }}>
              Reset Default
            </button>
          </div>
        </div>
        <input
          type="text"
          readOnly
          value={shareCode}
          aria-label="Encoded uic share code"
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, width: '100%' }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Paste uic: code to import..."
            style={{ flex: 1, fontSize: 11 }}
          />
          <button type="button" onClick={handleImportCode} style={{ fontSize: 11, padding: '4px 10px' }}>
            Import
          </button>
        </div>
        {codeFeedback ? (
          <span style={{ fontSize: 11, color: 'var(--ui-accent, #d96b43)' }}>{codeFeedback}</span>
        ) : null}
      </section>

      {/* Plan 58 Wave 3: Live 2,606 Harvested Multiverse Shelf + LitRPG Appraisal Lens */}
      <section style={{ padding: 12, background: 'var(--ui-inset, #232621)', border: '1px solid var(--ui-line, #353831)', borderRadius: 'var(--ui-radius, 2px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          6. Harvested Multiverse Shelf (2,606 Presets) & LitRPG Appraisal Lens
        </span>
        <HarvestedShelfAndAppraiseDeck
          onSelectPresetCode={(code, entry) =>
            setCodeFeedback(`Selected harvested preset ${entry.name} (${code}) from ${entry.sourceGame}.`)
          }
        />
      </section>
    </div>
  );
};
