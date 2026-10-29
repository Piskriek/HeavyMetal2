/**
 * Plan 58 Wave 2 & Plan 57 §19: The In-Game Rung-6 Wanderer Meta-Shell Drawer (`META_SHELL_SCREEN`).
 *
 * Renders the 3 modular `ui:` panels of `META_SHELL_SCREEN` (`wanderer-party`, `comms-drawer`, `clip-and-harness`)
 * via `UiPanelView`, plus a live `UI_STYLE_SHELF` switcher so players can restyle the entire HUD and interface
 * from inside Expedition / Play mode without leaving the world.
 */
import { useState, type ReactElement } from 'react';
import {
  DEFAULT_UI_STYLE_ID,
  META_SHELL_COMMANDS,
  META_SHELL_SCREEN,
  META_SHELL_SOURCES,
  UI_STYLE_SHELF,
  resolveUiStyle,
  uiTokensToCssVars,
  validateScreen,
  type UiScreen,
} from '@hm/hudlayout';
import {
  LOCALE_SHELF,
  createClipManifest,
  createCommsMessage,
  createPlayerWanderer,
  encodeClipShareCode,
  evaluateGuildComplex,
  evaluateParty,
  renderUtteranceVoiceAudio,
  synthesizeUtterance,
  type LocaleId,
} from '@hm/harness';
import type { Mem, StageId } from '@hm/shorthand';
import { UiPanelView } from './ui-panel';
import { HarvestedShelfAndAppraiseDeck } from './ui-appraise-lens';
import { type DroneMemory, DRONE_ROLES, stageIdOf } from './drone-memory';

const UI_STYLE_STORAGE_KEY = 'hm.setmix.ui.styleId';
const META_SCREEN_STORAGE_KEY = 'hm.setmix.ui.metaScreen';

export interface MetaShellValueInput {
  readonly stage: number;
  readonly droneMem: DroneMemory;
  readonly playerMem?: Mem;
  readonly lastCommsLine: string;
  readonly lastClipCode: string;
}

/**
 * Pure helper computing the source values for `META_SHELL_SCREEN` from the player's Wanderer state,
 * the Overwatch Drone's memory, Party Doubling ($2^{N-1}$), and Guild Social Memory Complex coherence.
 */
export function buildMetaShellValues(input: MetaShellValueInput): Readonly<Record<string, string | number | boolean>> {
  const stageId: StageId = stageIdOf(input.stage);
  const playerMem = input.playerMem ?? createPlayerWanderer();
  const party = evaluateParty([
    { id: 'player', name: 'Wanderer (You)', mem: playerMem, stage: stageId, worldGateCode: 'GATE-EARTH-01' },
    { id: 'drone', name: 'Overwatch Drone', mem: input.droneMem.ego, stage: stageId, worldGateCode: 'GATE-EARTH-01' },
  ]);
  const guild = evaluateGuildComplex({
    guildId: 'guild:setmix-enclave',
    guildName: 'SetMix Enclave',
    memberPresets: [playerMem, ...DRONE_ROLES.map((r) => input.droneMem.presets[r])],
    memberEgos: [{ ego: input.droneMem.ego, presets: DRONE_ROLES.map((r) => input.droneMem.presets[r].of) }],
  });

  return {
    'wanderer.bal': Math.round(playerMem.bal * 100) / 100,
    'wanderer.calm': `${Math.round(party.sharedAnchorCalm * 100)}% calm lent`,
    'party.doubling': `${party.doublingMultiplier}x (${party.harmoniousCount} aligned)`,
    'party.members': party.members.map((m) => `${m.name} (${Math.round(m.mem.bal * 100)}%)`).join(' · '),
    'guild.coherence': guild.pack.coherence,
    'comms.lastLine': input.lastCommsLine,
    'clip.lastCode': input.lastClipCode,
  };
}

/** Validates `META_SHELL_SCREEN` against `META_SHELL_SOURCES` and `META_SHELL_COMMANDS` (must return `[]`). */
export const metaShellIssues = (): ReturnType<typeof validateScreen> =>
  validateScreen(META_SHELL_SCREEN, META_SHELL_SOURCES, META_SHELL_COMMANDS);

function loadActiveMetaScreen(): UiScreen {
  try {
    const raw = window.localStorage.getItem(META_SCREEN_STORAGE_KEY);
    if (!raw) return META_SHELL_SCREEN;
    const parsed = JSON.parse(raw) as UiScreen;
    if (parsed && parsed.id === 'meta-shell' && Array.isArray(parsed.panels)) {
      const issues = validateScreen(parsed, META_SHELL_SOURCES, META_SHELL_COMMANDS);
      if (issues.length === 0) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return META_SHELL_SCREEN;
}

export interface MetaShellDrawerProps {
  readonly stage: number;
  readonly getDroneMemory: () => DroneMemory;
  readonly onCueHigherSelfDream: () => void;
  readonly onBroadcastNotice: (title: string, detail: string) => void;
}

export function MetaShellDrawer(props: MetaShellDrawerProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [styleId, setStyleId] = useState<string>(() => {
    try {
      return resolveUiStyle(window.localStorage.getItem(UI_STYLE_STORAGE_KEY)).id;
    } catch {
      return DEFAULT_UI_STYLE_ID;
    }
  });
  const [lastCommsLine, setLastCommsLine] = useState<string>('Ready on Party & Enclave channel (child-safe callouts active).');
  const [lastClipCode, setLastClipCode] = useState<string>('clip:ready — press Capture Replay Clip to mint a share code');
  const [locale, setLocale] = useState<LocaleId>('en');

  const applyStyle = (nextId: string): void => {
    const resolved = resolveUiStyle(nextId);
    setStyleId(resolved.id);
    try {
      window.localStorage.setItem(UI_STYLE_STORAGE_KEY, resolved.id);
      const vars = uiTokensToCssVars(resolved.tokens);
      const root = document.documentElement;
      for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    } catch {
      // ignore
    }
  };

  const droneMem = props.getDroneMemory();
  const values = buildMetaShellValues({
    stage: props.stage,
    droneMem,
    lastCommsLine,
    lastClipCode,
  });

  const sendCannedPing = (calloutId: 'ping:gate' | 'ping:craft' | 'ping:eureka'): void => {
    const msg = createCommsMessage({
      id: `msg-${calloutId}`,
      senderId: 'wanderer:local',
      channel: 'party',
      trustTier: 'unverified-or-child',
      calloutId,
      attachedPresets: [`ui:${styleId}`],
      tick: Math.max(0, props.stage * 100),
    });
    setLastCommsLine(msg.displayText);
    props.onBroadcastNotice('Wanderer Party Comms', msg.displayText);
  };

  const handleCaptureClip = (): void => {
    const stageId = stageIdOf(props.stage);
    const manifest = createClipManifest({
      clipId: `clip-${stageId.toLowerCase()}`,
      authorId: 'wanderer:local',
      worldSeed: 'earth-moon-plot',
      stage: stageId,
      trigger: 'manual',
      durationSec: 12,
      videoMime: 'video/webm;codecs=vp9',
      featuredPresets: [
        `ui:${styleId}`,
        ...DRONE_ROLES.map((r) => droneMem.presets[r].of),
      ],
      replayFrames: [`0:stage:${stageId}`, `60:bal:${Math.round(droneMem.ego.bal * 100)}`],
      caption: `Stage ${stageId} contraption & drone telemetry replay`,
    });
    const code = encodeClipShareCode(manifest);
    setLastClipCode(code);
    try {
      void navigator.clipboard?.writeText(code);
    } catch {
      // ignore clipboard restrictions
    }
    props.onBroadcastNotice('Replay Clip Minted', `${code.slice(0, 36)}… (copied to clipboard)`);
  };

  const handleCueDream = (): void => {
    props.onCueHigherSelfDream();
    props.onBroadcastNotice('Higher Self Dream Cued', 'Lowest-ray distortion queued for the next Moon/Gate checkpoint.');
  };

  const actions: Readonly<Record<string, () => void>> = {
    'comms.pingGate': () => sendCannedPing('ping:gate'),
    'comms.pingCraft': () => sendCannedPing('ping:craft'),
    'comms.pingEureka': () => sendCannedPing('ping:eureka'),
    'clip.capture': handleCaptureClip,
    'harness.cueDream': handleCueDream,
  };

  const screen = open ? loadActiveMetaScreen() : META_SHELL_SCREEN;

  return (
    <div
      data-testid="meta-shell-drawer-root"
      style={{
        position: 'fixed',
        top: '14px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 45,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'auto',
        fontFamily: 'var(--ui-font, "IBM Plex Sans", system-ui, sans-serif)',
      }}
    >
      <button
        type="button"
        data-testid="meta-shell-toggle"
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '5px 12px',
          borderRadius: 'var(--ui-radius, 4px)',
          border: '1px solid var(--ui-line, rgba(244,241,234,0.22))',
          background: open ? 'var(--ui-accent, #ea580c)' : 'var(--ui-panel, #1c1d21)',
          color: open ? 'var(--ui-accent-ink, #0d0e10)' : 'var(--ui-ink, #f4f1ea)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
        }}
      >
        {open ? 'CLOSE META-SHELL [ESC]' : `META · WANDERER (${String(values['party.doubling'])})`}
      </button>

      {open ? (
        <aside
          role="dialog"
          aria-label="Wanderer Meta-Shell & UI Preset Drawer"
          data-testid="meta-shell-drawer"
          style={{
            width: 'min(820px, 94vw)',
            maxHeight: '78vh',
            overflowY: 'auto',
            padding: '16px',
            borderRadius: 'var(--ui-radius, 4px)',
            border: '1px solid var(--ui-line, rgba(244,241,234,0.22))',
            background: 'var(--ui-panel, #1c1d21)',
            color: 'var(--ui-ink, #f4f1ea)',
            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.65)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--ui-line)', paddingBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Rung-6 Wanderer Meta-Shell · Party, Safe Comms & Clip Share
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ui-dim, #9e9b93)' }}>
                Screen preset: <code>{screen.id}</code> · Active UI style: <code>ui:{styleId}</code>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {UI_STYLE_SHELF.map((preset) => {
                const active = preset.id === styleId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyStyle(preset.id)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: active ? 700 : 500,
                      borderRadius: 'var(--ui-radius, 4px)',
                      border: `1px solid ${active ? preset.tokens.accent : 'var(--ui-line)'}`,
                      background: preset.tokens.paper,
                      color: preset.tokens.ink,
                      cursor: 'pointer',
                    }}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {screen.panels.map((panel) => (
              <div
                key={panel.id}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--ui-radius, 4px)',
                  border: '1px solid var(--ui-line)',
                  background: 'var(--ui-inset, #25272c)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <UiPanelView
                  panel={panel}
                  sources={META_SHELL_SOURCES}
                  values={values}
                  actions={actions}
                  title={{ text: panel.id.replace(/-/g, ' ').toUpperCase() }}
                  meterMax={{
                    'wanderer-bal': 1,
                    'guild-coherence': 1,
                  }}
                />
              </div>
            ))}
          </div>

          {(() => {
            const sampleUtt = synthesizeUtterance({
              rootId: 'ANCHOR_CALM_SHARED',
              slots: { calm: String(values['wanderer.calm']) },
              locale,
              mem: droneMem.ego,
            });
            return (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--ui-radius, 4px)',
                  border: '1px solid var(--ui-line)',
                  background: 'var(--ui-inset, #25272c)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Semantic-Emotional Voice & Locale Preset (Plan 58 §18 · <code>locale:{locale}</code>)
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(Object.keys(LOCALE_SHELF) as LocaleId[]).map((locId) => (
                      <button
                        key={locId}
                        type="button"
                        onClick={() => setLocale(locId)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '10px',
                          fontWeight: locId === locale ? 700 : 500,
                          borderRadius: 'var(--ui-radius, 4px)',
                          border: `1px solid ${locId === locale ? 'var(--ui-accent)' : 'var(--ui-line)'}`,
                          background: locId === locale ? 'var(--ui-accent)' : 'var(--ui-panel)',
                          color: locId === locale ? 'var(--ui-accent-ink)' : 'var(--ui-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {LOCALE_SHELF[locId].name}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ui-ink)' }}>
                  <b>Spoken:</b> {sampleUtt.spokenText}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ui-dim)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span><b>Full-Duplex Backchannel:</b> “{sampleUtt.backchannelText}”</span>
                  <span>
                    <b>Archetype:</b> {sampleUtt.envelope.polarity} ({sampleUtt.envelope.mindArchetype} / {sampleUtt.envelope.bodyArchetype}) ·{' '}
                    <b>Prosody:</b> {sampleUtt.webAudioProsody.baseFreqHz} Hz, {sampleUtt.envelope.tempoScale}x, {sampleUtt.envelope.timbreFilter}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const rendered = renderUtteranceVoiceAudio(sampleUtt, 22050, 1);
                        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                        if (AudioCtx) {
                          const ctx = new AudioCtx();
                          const buf = ctx.createBuffer(1, rendered.samples.length, 22050);
                          buf.getChannelData(0).set(rendered.samples);
                          const src = ctx.createBufferSource();
                          src.buffer = buf;
                          src.connect(ctx.destination);
                          src.start();
                        }
                        props.onBroadcastNotice(
                          `Somatic Voice (${sampleUtt.envelope.timbreFilter})`,
                          `${sampleUtt.spokenText} [${rendered.zeroCrossingHz} Hz ZCR, RMS ${rendered.rms}]`,
                        );
                      } catch {
                        // ignore audio context restrictions
                      }
                    }}
                    style={{
                      padding: '3px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      borderRadius: 'var(--ui-radius, 4px)',
                      border: '1px solid var(--ui-accent)',
                      background: 'var(--ui-panel)',
                      color: 'var(--ui-accent)',
                      cursor: 'pointer',
                    }}
                  >
                    ▶ Audition Somatic Voice (@hm/soundlab)
                  </button>
                </div>
              </div>
            );
          })()}

          <HarvestedShelfAndAppraiseDeck
            aiBeings={[
              {
                kind: 'ai-being',
                id: droneMem.ego.of,
                name: 'Overwatch Drone (Ego)',
                roleTitle: 'Rung 4 Companion Brain',
                author: 'SetMix Overwatch',
                mem: droneMem.ego,
              },
              {
                kind: 'ai-being',
                id: droneMem.presets.fire.of,
                name: 'Drone Fire Rhythm',
                roleTitle: 'Rung 3 Motion Preset',
                author: 'SetMix Overwatch',
                mem: droneMem.presets.fire,
              },
              {
                kind: 'ai-being',
                id: droneMem.presets.flight.of,
                name: 'Drone Flight Station',
                roleTitle: 'Rung 3 Locomotion Preset',
                author: 'SetMix Overwatch',
                mem: droneMem.presets.flight,
              },
              {
                kind: 'ai-being',
                id: 'species:00a1c405',
                name: 'Wanderer Anchor (You)',
                roleTitle: 'Rung 6 Player Wanderer',
                author: 'Player Sovereign',
                mem: createPlayerWanderer(),
              },
            ]}
            onInvokeVirginMind={(_id, line) => props.onBroadcastNotice('Blueprint 91.35 Invoked', line)}
            onSelectPresetCode={(code, entry) =>
              props.onBroadcastNotice('Harvested Preset Selected', `${entry.name} (${code}) ready for bench/beam`)
            }
          />
        </aside>
      ) : null}
    </div>
  );
}
